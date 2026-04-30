# Proyecto Migrado a Django (Estructura Local)

Este proyecto ha sido preparado para que puedas ejecutarlo localmente usando **Django** para el backend y **React** para el frontend (opcional) o directamente con el motor de plantillas de Django.

## Estructura
- `/finance`: App principal de Django (modelos, vistas de Patrimonio, Activos, Historial).
- `/core`: Configuración del proyecto Django.
- `/templates`: Vistas HTML renderizadas por servidor.
- `/requirements.txt`: Dependencias de Python.

## Cómo ejecutar en Local

### 1. Entorno de Python
1. Instala Python 3.10+.
2. Crea un entorno virtual: `python -m venv venv`
3. Actívalo:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Instala dependencias: `pip install -r requirements.txt`

### 2. Base de Datos y Superusuario
1. Genera las tablas: `python manage.py makemigrations && python manage.py migrate`
2. **IMPORTANTE:** Crea un usuario para poder entrar: `python manage.py createsuperuser`
3. Inicia el servidor: `python manage.py runserver`

### 3. Ver todas las funciones
- Ve a `http://localhost:8000/` para ver el Dashboard.
- Todas las acciones (añadir activos o transacciones) quedarán registradas en el historial de actividad vinculado a tu usuario.
- Los importes están configurados en **Euros (€)** por defecto en el código SQL y en las plantillas.

### 4. Funciones de IA (Opcional)
Para habilitar el Asesor de IA en local:
1. Obtén una clave de API en [Google AI Studio](https://aistudio.google.com/).
2. Crea un archivo llamado `.env` en la raíz del proyecto.
3. Añade la línea: `GEMINI_API_KEY=tu_clave_aqui`
4. Reinicia el servidor.

## ¿Por qué no funciona en GitHub Pages?
GitHub Pages es un servicio para **sitios estáticos**. Este proyecto ahora es una aplicación **Django profesional** con base de datos real (SQLite) y servidor de aplicaciones (Python). 
- **GitHub Pages:** Solo lee archivos HTML (como un currículum o una landing simple).
- **Este Proyecto:** Requiere un servidor que pueda "pensar" (Python) para registrar datos, calcular tu patrimonio y conectar con la IA.
- **Para Exponerlo:** Recomendamos usar servicios como **PythonAnywhere**, **Render** o **Railway**, que permiten desplegar Django gratis o a bajo coste.
