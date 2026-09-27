// Backend intermediario para ESMFold vía BioLM.ai.
//
// Mismo motivo que fold.js: BioLM requiere una clave privada (con crédito
// real asociado) que nunca debe quedar expuesta en una página web. Este
// archivo corre en el servidor de Vercel, guarda la clave en una variable
// de entorno (BIOLMAI_API_KEY) y hace de intermediario seguro.
//
// Devuelve el mismo formato que fold.js ({ pdb: "..." } o { error: "..." })
// para que la página HTML funcione igual sin importar cuál backend uses.

const BASE_URL = 'https://biolm.ai/api/v3/esmfold/predict/';
// Servidor de pruebas gratuito de BioLM (no gasta crédito real).
const MOCK_URL = 'https://mock.biolm.ai/api/v3/esmfold/predict/';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Usa POST.' });
    return;
  }

  const apiKey = process.env.BIOLMAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'Falta configurar BIOLMAI_API_KEY en las variables de entorno de Vercel (Settings → Environment Variables).'
    });
    return;
  }

  const sequence = (req.body && req.body.sequence) || '';
  const clean = String(sequence).trim().toUpperCase();

  if (!clean) {
    res.status(400).json({ error: 'Falta el campo "sequence" en el cuerpo de la petición.' });
    return;
  }
  if (!/^[ARNDCQEGHILKMFPSTWYVXBOU]+$/.test(clean)) {
    res.status(400).json({ error: 'La secuencia contiene caracteres que no son aminoácidos válidos.' });
    return;
  }

  // Modo de prueba gratis: llama a POST /?mock=1 (o agrega ?mock=1 a la URL
  // del backend en la página) para usar mock.biolm.ai y no gastar crédito.
  const useMock = req.query && (req.query.mock === '1' || req.query.mock === 'true');
  const url = useMock ? MOCK_URL : BASE_URL;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      // BioLM espera una lista de items, cada uno con la secuencia.
      // Aquí mandamos un solo item por llamada.
      body: JSON.stringify({ items: [{ sequence: clean }] })
    });

    if (response.status === 401 || response.status === 403) {
      res.status(response.status).json({ error: 'La clave BIOLMAI_API_KEY no es válida, expiró, o no tiene crédito suficiente.' });
      return;
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      res.status(response.status).json({ error: detail || `BioLM devolvió un error (${response.status}).` });
      return;
    }

    const data = await response.json();
    const first = Array.isArray(data.results) ? data.results[0] : null;

    if (!first) {
      res.status(502).json({ error: 'La respuesta de BioLM no trajo resultados reconocibles.', raw: data });
      return;
    }
    if (first.error) {
      res.status(400).json({ error: String(first.error) });
      return;
    }
    if (!first.pdb) {
      res.status(502).json({ error: 'La respuesta de BioLM no incluyó un PDB.', raw: first });
      return;
    }

    res.status(200).json({ pdb: first.pdb, mean_plddt: first.mean_plddt, ptm: first.ptm });

  } catch (err) {
    res.status(500).json({ error: 'Error llamando a la API de BioLM: ' + err.message });
  }
