/**
 * AWS Lambda handler para /report da Watchlist.
 *
 * Consome a API via API Gateway (HTTP) e retorna estatísticas em JSON.
 * NÃO acessa o RDS diretamente — requisito do enunciado.
 */

const API_GATEWAY_URL =
  process.env.API_GATEWAY_URL || "http://localhost";

export const handler = async () => {
  try {
    const res = await fetch(`${API_GATEWAY_URL}/titles/`);
    if (!res.ok) {
      throw new Error(`API retornou ${res.status}: ${res.statusText}`);
    }
    const titles = await res.json();

    if (!Array.isArray(titles) || titles.length === 0) {
      return ok({ message: "Nenhum título encontrado", stats: {} });
    }

    const por_tipo = countBy(titles, (t) => t.kind);
    const por_genero = countBy(
      titles.filter((t) => t.genre),
      (t) => t.genre,
    );

    const assistidos = titles.filter((t) => t.watched).length;
    const nao_assistidos = titles.length - assistidos;
    const percentual_assistido = Math.round(
      (assistidos / titles.length) * 100,
    );

    const comDuracao = titles.filter((t) => t.duration_minutes != null);
    const duracao_media_minutos =
      comDuracao.length > 0
        ? Math.round(
            comDuracao.reduce((acc, t) => acc + t.duration_minutes, 0) /
              comDuracao.length,
          )
        : 0;

    const comNota = titles.filter((t) => t.rating != null);
    const nota_media =
      comNota.length > 0
        ? Number(
            (
              comNota.reduce((acc, t) => acc + t.rating, 0) / comNota.length
            ).toFixed(2),
          )
        : 0;

    const generosAssistidos = titles
      .filter((t) => t.watched && t.genre)
      .reduce((acc, t) => {
        acc[t.genre] = (acc[t.genre] || 0) + 1;
        return acc;
      }, {});
    const top_genero_assistido =
      Object.entries(generosAssistidos).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      null;

    return ok({
      total_titulos: titles.length,
      por_tipo,
      por_genero,
      assistidos,
      nao_assistidos,
      percentual_assistido,
      duracao_media_minutos,
      nota_media,
      top_genero_assistido,
    });
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Erro ao gerar relatório",
        message: err.message,
      }),
    };
  }
};

function countBy(arr, fn) {
  return arr.reduce((acc, item) => {
    const key = fn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function ok(payload) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(payload, null, 2),
  };
}
