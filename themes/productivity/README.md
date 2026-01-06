# Productivity Theme

## Activación

Para usar este theme, configura en `.env`:

```bash
NEXT_PUBLIC_ACTIVE_THEME=productivity
```

Luego regenera el registry y reinicia el servidor:

```bash
npx tsx scripts/build-registry.mjs --build
pnpm dev
```

## Funcionalidades

### Kanban Board

Vista de tablero estilo Trello con:

- **Boards**: Tableros de proyectos
- **Lists**: Columnas dentro de cada tablero
- **Cards**: Tarjetas/tareas arrastrables

### Drag and Drop

Implementado con `@dnd-kit`:
- Arrastrar cards entre lists
- Reordenar cards dentro de una list
- Visual feedback durante el drag

### Componentes

```
components/
├── KanbanBoard.tsx     # Tablero completo con DnD context
├── KanbanColumn.tsx    # Columna con drop zone
├── KanbanCard.tsx      # Tarjeta draggable
└── index.ts            # Exports
```

### Templates Override

```
templates/
└── app/dashboard/(main)/boards/
    ├── page.tsx           # Grid de boards
    └── [id]/
        └── page.tsx       # Vista Kanban del board
```

## Permisos

| Entidad | create | read | update | delete | archive |
|---------|:------:|:----:|:------:|:------:|:-------:|
| boards | owner, admin | todos | owner, admin | owner | owner, admin |
| lists | owner, admin | todos | owner, admin | owner, admin | - |
| cards | todos | todos | todos | owner, admin | - |

## Usuarios de Prueba

| Email | Password | Rol en Product Team |
|-------|----------|---------------------|
| pm.torres@nextspark.dev | Testing1234 | owner |
| dev.luna@nextspark.dev | Testing1234 | admin |
| design.rios@nextspark.dev | Testing1234 | member |

## Modo

- **Teams Mode**: `collaborative`
- Team switcher habilitado
- Puede crear equipos de trabajo

