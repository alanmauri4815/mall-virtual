# Restauracion del respaldo canonico

Cada respaldo conserva el estado completo del codigo correspondiente a su etiqueta.

## Restauracion segura

Restaura primero en una carpeta nueva. El proceso no reemplaza ni elimina el proyecto actual.

```powershell
.\restore.ps1 -TargetPath "C:\ruta\Mall-Restaurado"
```

El script valida el hash SHA-256 de cada archivo antes y despues de copiarlo. Si la carpeta de destino contiene archivos, se detiene. `-AllowExisting` solo debe utilizarse despues de revisar el destino.

## Contenido auxiliar

- `manifest-sha256.csv`: integridad de todos los archivos del snapshot.
- `git-status.txt`: cambios existentes al crear el respaldo.
- `current-changes.patch`: diferencias no confirmadas en Git.
- `staged-changes.patch`: diferencias que estaban preparadas en Git.
- `tracked-files.txt`: archivos bajo control de versiones.
- `untracked-files.txt`: archivos no registrados y no ignorados.
- `deployment-info.json`: proyecto y dominios publicos conocidos.

Los perfiles de navegador, caches, secretos locales y respaldos historicos no se duplican dentro de este snapshot.
