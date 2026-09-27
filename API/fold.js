// Backend intermediario para ESMFold vía NVIDIA NIM.
//
// Por qué existe este archivo: la API de NVIDIA (health.api.nvidia.com)
// no permite llamadas directas desde el navegador (bloquea CORS) y requiere
// una clave privada que nunca debe quedar expuesta en una página web. Este
// archivo corre en el servidor de Vercel, guarda la clave en una variable
// de entorno (NVIDIA_API_KEY) y actúa como intermediario seguro entre tu
// página HTML y NVIDIA.
//
// Acepta secuencias de hasta 1024 aminoácidos (contra los 400 de la API
// gratuita ESM Atlas que no requiere backend).

export default async function handler(req, res) {
  // Permite que tu página HTML (en cualquier dominio) llame a este backend.
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

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'Falta configurar NVIDIA_API_KEY en las variables de entorno de Vercel (Settings → Environment Variables).'
    });
    return;
  }

  const sequence = (req.body && req.body.sequence) || '';
  const clean = String(sequence).trim().toUpperCase();

  if (!clean) {
    res.status(400).json({ error: 'Falta el campo "sequence" en el cuerpo de la petición.' });
    return;
  }
  if (clean.length > 1024) {
    res.status(400).json({ error: `La secuencia tiene ${clean.length} aminoácidos; el máximo de este backend es 1024.` });
    return;
  }
  if (!/^[ARNDCQEGHILKMFPSTWYVXBOU]+$/.test(clean)) {
    res.status(400).json({ error: 'La secuencia contiene caracteres que no son aminoácidos válidos.' });
    return;
  }

  try {
    let response = await fetch('https://health.api.nvidia.com/v1/biology/nvidia/esmfold', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'NVCF-POLL-SECONDS': '300'
      },
      body: JSON.stringify({ sequence: clean })
    });

    // Las funciones hospedadas de NVIDIA (NVCF) a veces responden 202
    // ("procesando") en vez de darte el resultado de inmediato. Hay que
    // consultar el estado hasta que termine.
    if (response.status === 202) {
      const reqId = response.headers.get('nvcf-reqid');
      if (!reqId) {
        res.status(502).json({ error: 'NVIDIA aceptó la tarea pero no devolvió un ID para consultar el resultado.' });
        return;
      }
      const pollUrl = `https://health.api.nvidia.com/v1/status/${reqId}`;
      let finished = false;
      for (let attempt = 0; attempt < 55; attempt++) {
        await new Promise((r) => setTimeout(r, 5000));
        response = await fetch(pollUrl, { headers: { 'Authorization': `Bearer ${apiKey}` } });
        if (response.status !== 202) {
          finished = true;
          break;
        }
      }
      if (!finished) {
        res.status(504).json({ error: 'La predicción no terminó a tiempo (más de 4 minutos). Intenta de nuevo.' });
        return;
      }
    }

    if (response.status === 401) {
      res.status(401).json({ error: 'La clave NVIDIA_API_KEY no es válida o no tiene acceso a este modelo.' });
      return;
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      res.status(response.status).json({ error: detail || `NVIDIA devolvió un error (${response.status}).` });
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    let pdbText;

    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (Array.isArray(data.pdbs) && data.pdbs.length > 0) {
        pdbText = data.pdbs[0];
      } else if (typeof data.pdb === 'string') {
        pdbText = data.pdb;
      } else {
        res.status(502).json({ error: 'La respuesta de NVIDIA no trajo un PDB reconocible.', raw: data });
        return;
      }
    } else {
      pdbText = await response.text();
    }

    res.status(200).json({ pdb: pdbText });

  } catch (err) {
    res.status(500).json({ error: 'Error llamando a la API de NVIDIA: ' + err.message });
  }
}
