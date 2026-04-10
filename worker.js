/**
 * KO95FIT - Cloudflare Worker IA
 * Pega este codigo en: https://dash.cloudflare.com -> Workers -> consejosapp -> Edit
 * 
 * Modelos verificados activos en OpenRouter (Marzo 2026)
 */
export default {
  async fetch(request, env) {
    // Manejo de CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      if (request.method !== 'POST') throw new Error("Solo se aceptan peticiones POST.");
      if (!env.OPENROUTER_API_KEY) throw new Error("Variable OPENROUTER_API_KEY no configurada en Cloudflare.");

      const body = await request.json();
      const { messages } = body;
      if (!messages || !messages.length) throw new Error("No se enviaron mensajes.");

      const MODELS = [
        "google/gemini-2.0-flash-lite-preview-02-05:free", // 1º Intento: GRATIS veloz
        "openrouter/free",                                 // 2º Intento: GRATIS auto
        "meta-llama/llama-3.3-70b-instruct:free",          // 3º GRATIS (Rápido y potente)
        "qwen/qwen-2.5-72b-instruct:free",                 // 4º GRATIS (Muy veloz)
        "mistralai/mistral-nemo:free",                     // 5º GRATIS (Extra veloz)
        "microsoft/phi-3-medium-128k-instruct:free",       // 6º GRATIS (Respaldo ágil)
        "openrouter/auto"                                  // 7º Router balanceado calidad/precio aconsejado
      ];

      let aiContent = null;
      const errors = [];

      for (const model of MODELS) {
        try {
          const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.OPENROUTER_API_KEY.trim()}`,
              "HTTP-Referer": "https://ko95fit.app",
              "X-Title": "KO95FIT",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: model,
              messages: messages,
              temperature: 0.7
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            if (data.choices && data.choices[0]) {
              aiContent = data.choices[0].message.content;
              break; // Exito!
            }
          } else {
            const errText = await resp.text();
            errors.push(`${model}(${resp.status}:${errText.substring(0, 50)})`);
            // Si la clave es invalida, no seguimos intentando
            if (resp.status === 401 || resp.status === 403) {
              throw new Error(`API KEY invalida. Revisa tu clave en OpenRouter. (${resp.status}): ${errText}`);
            }
          }
        } catch (e) {
          if (e.message.includes("API KEY")) throw e;
          errors.push(`${model}(red_error)`);
        }
      }

      if (!aiContent) {
        throw new Error(`Detalle de fallo: ${errors.join(' || ')}`);
      }

      return new Response(aiContent, {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};
