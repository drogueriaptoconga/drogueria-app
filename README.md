# Droguería App

Proyecto fullstack (Express + React) usado en la Droguería.

Quick start (developer machine):

1. Clona el repo:

```bash
git clone https://github.com/<tu-usuario>/<repo>.git
cd <repo>
```

2. Instala dependencias backend:

```bash
npm install
```

3. Instala dependencias frontend:

```bash
cd fronted
npm install
```

4. Crea un archivo `.env` en la raíz con los datos reales (NO subirlo):

```
DB_HOST=<IP_o_hostname_del_cliente>
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<contraseña_real>
DB_NAME=drogueria_db
DB_SSL=false
```

5. Ejecuta backend:

```bash
npm run dev
```

6. Ejecuta frontend (en otra terminal):

```bash
cd fronted
npm start
```

Security notes:
- Do not commit `.env` or backups to the repository.
- Use the `.env.example` as template.
