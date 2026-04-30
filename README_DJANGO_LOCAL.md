# Proyecto Migrado a Django (Estructura Local)

Este proyecto ha sido preparado para que puedas ejecutarlo localmente usando **Django** para el backend y **React** para el frontend.

## Estructura
- `/src`: Código frontend en React (Vite).
- `/django_backend`: Backend robusto en Django + Django Rest Framework.

## Cómo ejecutar en Local

### 1. Backend (Django)
1. Instala Python 3.10+.
2. Ve a la carpeta del backend: `cd django_backend`
3. Crea un entorno virtual: `python -m venv venv`
4. Actívalo:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
5. Instala dependencias: `pip install -r requirements.txt`
6. Migraciones: `python manage.py migrate`
7. Inicia el servidor: `python manage.py runserver`

### 2. Frontend (React)
1. Ve a la raíz del proyecto.
2. Instala dependencias: `npm install`
3. Inicia el frontend: `npm run dev`

### Notas
- Para conectarlo totalmente en local, deberás cambiar las llamadas de `Firebase` en `src/App.tsx` por llamadas `fetch` o `axios` a `http://localhost:8000/api/...`.
- Si prefieres seguir usando Firebase como base de datos en la nube desde Django, he incluido `firebase-admin` en los requisitos.

## Exportar
Usa el menú **Settings -> Export to GitHub** de AI Studio para llevarte todo este código a tu repositorio personal.
