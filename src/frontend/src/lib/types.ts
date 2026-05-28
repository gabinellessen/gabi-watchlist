export type Title = {
  id: number;
  name: string;
  kind: "movie" | "series";
  genre: string | null;
  year: number | null;
  duration_minutes: number | null;
  rating: number | null;
  watched: boolean;
  notes: string | null;
};

export type TitleInput = Omit<Title, "id">;

export type Report = {
  total_titulos: number;
  por_tipo: Record<string, number>;
  por_genero: Record<string, number>;
  assistidos: number;
  nao_assistidos: number;
  percentual_assistido: number;
  duracao_media_minutos: number;
  nota_media: number;
  top_genero_assistido: string | null;
};
