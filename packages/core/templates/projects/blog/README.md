# Blog Theme

## Uso

Este template se copia una sola vez al crear el proyecto; después todos sus archivos son del proyecto:

```bash
pnpm dlx create-nextspark-app@latest mi-proyecto --theme blog
cd mi-proyecto
pnpm dev
```

`pnpm dev` genera `src/app` y los registries (`pnpm build:registries` lo hace sin arrancar el servidor).

## Funcionalidades

### Permisos

Los permisos están configurados en `permissions.config.ts`:

| Feature | Descripción | Roles |
|---------|-------------|-------|

### Componentes

```
components/
├── editor/                  # Editor de contenido e imagen destacada
└── public/                  # Componentes del blog público
```

### Templates Override

```
templates/
└── templates/dashboard/(main)/posts/
    └── page.tsx             # Lista de posts con toolbar
```

## Usuario de Prueba

| Email | Password | Rol |
|-------|----------|-----|
| blogger@nextspark.dev | Testing1234 | owner |

## Modo

- **Teams Mode**: `single-user`
- Sin colaboración
- Sin team switcher

