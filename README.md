# Backend ESMFold (hasta 1024 aminoácidos)

Este backend le hace de intermediario seguro a la página del predictor de proteínas: guarda tu clave de NVIDIA en el servidor (nunca en el HTML) y llama a la API de NVIDIA NIM para folding de secuencias de hasta 1024 aminoácidos.

## 1. Consigue una clave gratis de NVIDIA
1. Entra a https://build.nvidia.com
2. Busca el modelo **esmfold** (de Meta).
3. Haz clic en "Get API Key" (necesitas una cuenta gratis, sin tarjeta).
4. Copia la clave, empieza con `nvapi-...`.

## 2. Sube esta carpeta a GitHub
1. Crea un repositorio nuevo en https://github.com/new
2. Sube estos archivos (`api/fold.js`, `package.json`, este README) al repositorio.

## 3. Despliega en Vercel
1. Entra a https://vercel.com y crea una cuenta gratis.
2. Clic en "Add New" → "Project" → elige el repositorio que acabas de subir.
3. Antes de darle a "Deploy", ve a **Environment Variables** y agrega:
   - Nombre: `NVIDIA_API_KEY`
   - Valor: la clave `nvapi-...` del paso 1
4. Clic en "Deploy". En un minuto te da una URL como `https://tu-proyecto.vercel.app`.

## 4. Conéctalo con la página del predictor
En la página HTML del predictor de proteínas, pega esta URL en el campo "Backend propio":

```
https://tu-proyecto.vercel.app/api/fold
```

Listo — ahora la página acepta secuencias de hasta 1024 aminoácidos en vez de 400.

## Alternativa: usar BioLM en vez de NVIDIA

Si ya tienes una clave de BioLM (biolm.ai), este proyecto también incluye `api/fold-biolm.js`, con el mismo contrato de respuesta, así que no hay que tocar la página HTML — solo cambiar qué URL le pegas.

1. En BioLM: `Console de tu cuenta → API Keys` para conseguir tu clave (empieza distinto a `nvapi-`, es un token propio de BioLM).
2. En Vercel, agrega otra variable de entorno:
   - Nombre: `BIOLMAI_API_KEY`
   - Valor: tu clave de BioLM
3. En la página del predictor, en "Backend propio", pega:

```
https://tu-proyecto.vercel.app/api/fold-biolm
```

**Modo de prueba gratis (sin gastar crédito real):** BioLM ofrece un servidor "mock" para pruebas. Agrega `?mock=1` al final de la URL:

```
https://tu-proyecto.vercel.app/api/fold-biolm?mock=1
```

Con `?mock=1` no vas a obtener una estructura real (son datos de prueba), pero te sirve para confirmar que todo el cableado (clave, backend, página) funciona antes de gastar tu presupuesto real. Cuando confirmes que anda, quita el `?mock=1` para folding real.

BioLM no tiene el límite fijo de 400 o 1024 de las otras dos opciones — el máximo depende de tu plan y tiempo de cómputo disponible (secuencias largas tardan más: ~500 aminoácidos pueden tomar varios minutos).


## Notas
- Tu clave de NVIDIA queda guardada solo en Vercel (variable de entorno), nunca visible en el código HTML ni accesible por quien abra la página.
- El plan gratuito de Vercel y el "Free Endpoint" de NVIDIA no requieren tarjeta de crédito, pero ambos tienen límites de uso razonables para uso personal/pruebas.
