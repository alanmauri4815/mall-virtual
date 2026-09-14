# Flujo estable de publicacion en Vercel

## Objetivo

Evitar trabajar con URLs temporales de deployment y usar una sola URL oficial.

## URL oficial recomendada

- `https://mall-virtual-one.vercel.app`

## Como publicar

Desde la carpeta del proyecto, ejecuta:

```powershell
.\deploy_vercel_stable.ps1
```

El script hace esto:

1. publica un nuevo deployment de produccion;
2. detecta la URL del deployment nuevo;
3. intenta asignarle el alias estable `mall-virtual-one.vercel.app`;
4. si ese alias esta ocupado, intenta dejar al menos `mall-virtual-one-mu.vercel.app`.

## Regla practica

- No compartas la URL larga del deployment.
- No uses como referencia visual las URLs antiguas.
- Revisa siempre la URL oficial que informe el script al final.

## Si `mall-virtual-one.vercel.app` sigue mostrando una version antigua

Eso significa que ese alias esta asignado a otro deployment o incluso a otro proyecto dentro de Vercel.

En ese caso:

1. entra al dashboard de Vercel;
2. busca el alias `mall-virtual-one.vercel.app`;
3. liberalo del deployment/proyecto antiguo;
4. vuelve a ejecutar:

```powershell
.\deploy_vercel_stable.ps1
```

## Verificacion rapida

Puedes comprobar la URL publica con:

```powershell
Invoke-WebRequest https://mall-virtual-one.vercel.app/ -UseBasicParsing
```

o con la URL alternativa:

```powershell
Invoke-WebRequest https://mall-virtual-one-mu.vercel.app/ -UseBasicParsing
```
