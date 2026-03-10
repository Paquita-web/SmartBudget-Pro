# Proyecto de Finanzas Personales (Django Version)

Esta es la versión en **Django y Python** de la aplicación de finanzas, lista para ser exportada y ejecutada localmente.

## Requisitos
- Python 3.10+
- pip

## Instalación Local

1. **Crear un entorno virtual:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   ```

2. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Migrar la base de datos:**
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

4. **Crear un superusuario:**
   ```bash
   python manage.py createsuperuser
   ```

5. **Ejecutar el servidor:**
   ```bash
   python manage.py runserver
   ```

La API estará disponible en `http://127.0.0.1:8000/api/`.

## Estructura
- `finance_app/`: Contiene los modelos de Transacciones, Presupuestos, Metas e Inversiones.
- `finance_project/`: Configuración principal de Django y rutas de la API.
- `requirements.txt`: Lista de librerías necesarias.
