import os
from collections import Counter
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlmodel import Field, Session, SQLModel, create_engine, select

load_dotenv()


class Title(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    kind: str  # 'movie' | 'series'
    genre: Optional[str] = None
    year: Optional[int] = None
    duration_minutes: Optional[int] = None
    rating: Optional[float] = None
    watched: bool = Field(default=False)
    notes: Optional[str] = None


class TitleCreate(SQLModel):
    name: str
    kind: str
    genre: Optional[str] = None
    year: Optional[int] = None
    duration_minutes: Optional[int] = None
    rating: Optional[float] = None
    watched: bool = False
    notes: Optional[str] = None


class TitleUpdate(SQLModel):
    name: Optional[str] = None
    kind: Optional[str] = None
    genre: Optional[str] = None
    year: Optional[int] = None
    duration_minutes: Optional[int] = None
    rating: Optional[float] = None
    watched: Optional[bool] = None
    notes: Optional[str] = None


DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")

engine = None


def ensure_database_exists() -> None:
    admin_url = (
        f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/postgres"
    )
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text(f"SELECT 1 FROM pg_database WHERE datname = '{DB_NAME}'")
            ).fetchone()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{DB_NAME}"'))
                print(f"Database '{DB_NAME}' created")
            else:
                print(f"Database '{DB_NAME}' already exists")
    except Exception as e:
        print(f"Error checking/creating database: {e}")
    finally:
        admin_engine.dispose()

    global engine
    db_url = (
        f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    engine = create_engine(db_url, echo=False)


def create_tables() -> None:
    SQLModel.metadata.create_all(engine)


def fix_sequence() -> None:
    """Sincroniza a sequência do PostgreSQL com o maior ID inserido pelo seed."""
    try:
        with engine.begin() as conn:
            max_id = conn.execute(text("SELECT COALESCE(MAX(id), 0) FROM title")).scalar() or 0
            seq_exists = conn.execute(
                text("SELECT 1 FROM pg_class WHERE relname = 'title_id_seq'")
            ).scalar()
            if seq_exists:
                conn.execute(text(f"SELECT setval('title_id_seq', {int(max_id)}, true)"))
                print(f"Sequence title_id_seq set to {max_id}")
    except Exception as e:
        print(f"Could not adjust sequence (often OK on first boot): {e}")


def is_table_empty() -> bool:
    try:
        with Session(engine) as session:
            return session.exec(select(Title).limit(1)).first() is None
    except Exception:
        return True


def initialize_sample_data() -> None:
    if not is_table_empty():
        print("Title table not empty; skipping seed")
        return
    sql_file = Path(__file__).parent / "initialize.sql"
    if not sql_file.exists():
        print("initialize.sql not found; skipping seed")
        return
    try:
        with engine.begin() as conn:
            sql_content = sql_file.read_text(encoding="utf-8")
            sql_clean = "\n".join(
                line
                for line in sql_content.split("\n")
                if line.strip() and not line.strip().startswith("--")
            ).rstrip(";").strip()
            if sql_clean:
                conn.execute(text(sql_clean))
                print("Sample data inserted")
    except Exception as e:
        print(f"Error inserting seed: {e}")


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_database_exists()
    create_tables()
    initialize_sample_data()
    fix_sequence()
    yield


app = FastAPI(title="Watchlist API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "Watchlist API",
        "version": "1.0",
        "endpoints": {
            "list": "GET /titles/",
            "get": "GET /titles/{id}",
            "create": "POST /titles/",
            "update": "PUT /titles/{id}",
            "delete": "DELETE /titles/{id}",
            "report_dev": "GET /report (em produção é servido pela Lambda)",
        },
    }


@app.get("/titles/", response_model=List[Title])
def list_titles(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=100)] = 100,
) -> List[Title]:
    return session.exec(select(Title).offset(offset).limit(limit)).all()


@app.get("/titles/{title_id}", response_model=Title)
def get_title(title_id: int, session: SessionDep) -> Title:
    title = session.get(Title, title_id)
    if not title:
        raise HTTPException(status_code=404, detail="Title not found")
    return title


@app.post("/titles/", response_model=Title)
def create_title(title: TitleCreate, session: SessionDep) -> Title:
    db_title = Title(**title.model_dump())
    session.add(db_title)
    session.commit()
    session.refresh(db_title)
    return db_title


@app.put("/titles/{title_id}", response_model=Title)
def update_title(title_id: int, patch: TitleUpdate, session: SessionDep) -> Title:
    db_title = session.get(Title, title_id)
    if not db_title:
        raise HTTPException(status_code=404, detail="Title not found")
    for key, value in patch.model_dump(exclude_unset=True).items():
        setattr(db_title, key, value)
    session.add(db_title)
    session.commit()
    session.refresh(db_title)
    return db_title


@app.delete("/titles/{title_id}")
def delete_title(title_id: int, session: SessionDep):
    title = session.get(Title, title_id)
    if not title:
        raise HTTPException(status_code=404, detail="Title not found")
    session.delete(title)
    session.commit()
    return {"ok": True}


@app.get("/report")
def report_dev(session: SessionDep):
    """Rota de DEV. Em produção, /report é servido pela Lambda via API Gateway.

    Mantemos essa rota aqui pra desenvolvimento local do front sem precisar rodar
    a Lambda. A lógica é idêntica à da função `src/lambda/index.mjs`.
    """
    titles = session.exec(select(Title)).all()
    if not titles:
        return {"message": "Nenhum título", "stats": {}}

    com_duracao = [t for t in titles if t.duration_minutes is not None]
    com_nota = [t for t in titles if t.rating is not None]
    assistidos = sum(1 for t in titles if t.watched)
    generos_assistidos = Counter(t.genre for t in titles if t.watched and t.genre)

    return {
        "total_titulos": len(titles),
        "por_tipo": dict(Counter(t.kind for t in titles)),
        "por_genero": dict(Counter(t.genre for t in titles if t.genre)),
        "assistidos": assistidos,
        "nao_assistidos": len(titles) - assistidos,
        "percentual_assistido": round((assistidos / len(titles)) * 100),
        "duracao_media_minutos": (
            round(sum(t.duration_minutes for t in com_duracao) / len(com_duracao))
            if com_duracao
            else 0
        ),
        "nota_media": (
            round(sum(t.rating for t in com_nota) / len(com_nota), 2)
            if com_nota
            else 0.0
        ),
        "top_genero_assistido": (
            generos_assistidos.most_common(1)[0][0] if generos_assistidos else None
        ),
    }
