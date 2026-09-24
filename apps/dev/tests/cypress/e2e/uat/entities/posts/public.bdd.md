# Public Post Display - UAT (Format: BDD/Gherkin - Bilingual)

> **Test File:** `posts-public.cy.ts`
> **Format:** Behavior-Driven Development (BDD) with Given/When/Then
> **Languages:** English / Spanish (side-by-side)
> **Total Tests:** 13 (10 active, 3 skipped)

---

## Feature: Public Post Display

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

As a **public visitor**
I want to **view published blog posts**
So that **I can read the website content**

**Key Functionality:**
- Published posts render at /blog/[slug]
- Post header, excerpt, and blocks display
- Categories show with colors
- Unpublished posts return 404

</td>
<td>

Como **visitante publico**
Quiero **ver posts de blog publicados**
Para **leer el contenido del sitio web**

**Funcionalidad Clave:**
- Posts publicados renderizan en /blog/[slug]
- Encabezado, extracto y bloques del post se muestran
- Categorias se muestran con colores
- Posts no publicados retornan 404

</td>
</tr>
</table>

---

## Post Rendering

### POST-PUB-001: Should render a published post `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Published post renders successfully

Given there is a published post "welcome-to-our-blog"
When I visit the post at /blog/welcome-to-our-blog
Then the post should load successfully
And the post container should be visible
```

</td>
<td>

```gherkin
Scenario: Post publicado renderiza exitosamente

Given existe un post publicado "welcome-to-our-blog"
When visito el post en /blog/welcome-to-our-blog
Then el post deberia cargar exitosamente
And el contenedor del post deberia estar visible
```

</td>
</tr>
</table>

---

### POST-PUB-002: Should display post header

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Post header displays correctly

Given I am on a published post page
When the post loads completely
Then the post header should be visible
And the title should contain "Welcome"
```

</td>
<td>

```gherkin
Scenario: Encabezado del post se muestra correctamente

Given estoy en una pagina de post publicado
When el post carga completamente
Then el encabezado del post deberia estar visible
And el titulo deberia contener "Welcome"
```

</td>
</tr>
</table>

---

### POST-PUB-003: Should display post excerpt

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Post excerpt is visible

Given I am on a published post page
When the post loads completely
Then the post excerpt should be visible
And the excerpt should provide a summary
```

</td>
<td>

```gherkin
Scenario: Extracto del post es visible

Given estoy en una pagina de post publicado
When el post carga completamente
Then el extracto del post deberia estar visible
And el extracto deberia proveer un resumen
```

</td>
</tr>
</table>

---

## Block Rendering

### POST-PUB-004: Should render post blocks

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Post blocks render correctly

Given I am on a published post page
When the post loads completely
Then the post content area should be visible
And headings (h1, h2, h3) should exist within content
```

</td>
<td>

```gherkin
Scenario: Bloques del post renderizan correctamente

Given estoy en una pagina de post publicado
When el post carga completamente
Then el area de contenido del post deberia estar visible
And encabezados (h1, h2, h3) deberian existir dentro del contenido
```

</td>
</tr>
</table>

---

### POST-PUB-005: Should render hero block correctly

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Hero block renders with content

Given I am on a published post with a hero block
When the post loads completely
Then the content area should contain "Welcome" text
And the hero content should be properly formatted
```

</td>
<td>

```gherkin
Scenario: Bloque hero renderiza con contenido

Given estoy en un post publicado con bloque hero
When el post carga completamente
Then el area de contenido deberia contener texto "Welcome"
And el contenido hero deberia estar correctamente formateado
```

</td>
</tr>
</table>

---

## Category Display

### POST-PUB-006: Should display category badges

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Category badges are displayed

Given I am on a published post with categories
When the post loads completely
Then the "News" category badge should be visible
And category badges should be clickable or labeled
```

</td>
<td>

```gherkin
Scenario: Insignias de categoria se muestran

Given estoy en un post publicado con categorias
When el post carga completamente
Then la insignia de categoria "News" deberia estar visible
And las insignias de categoria deberian ser clickeables o etiquetadas
```

</td>
</tr>
</table>

---

### POST-PUB-007: Should display category badges with colors

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Category badges have color styling

Given I am on a published post with categories
When the post loads completely
Then category badges should have color styling
And badges should have background or text color defined
```

</td>
<td>

```gherkin
Scenario: Insignias de categoria tienen estilo de color

Given estoy en un post publicado con categorias
When el post carga completamente
Then las insignias de categoria deberian tener estilo de color
And las insignias deberian tener color de fondo o texto definido
```

</td>
</tr>
</table>

---

## SEO Meta Tags `@in-development`

### POST-PUB-008: Should have correct page title ⏸️ SKIPPED

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
@in-development
Scenario: Page title includes post title

Given I am on a published post page
When the post loads completely
Then the page title should include "Welcome"
And the title tag should be SEO-friendly
```

**Status:** Skipped - SEO meta tags implementation pending.

</td>
<td>

```gherkin
@in-development
Scenario: Titulo de pagina incluye titulo del post

Given estoy en una pagina de post publicado
When el post carga completamente
Then el titulo de la pagina deberia incluir "Welcome"
And la etiqueta title deberia ser SEO-friendly
```

**Estado:** Omitido - Implementacion de meta tags SEO pendiente.

</td>
</tr>
</table>

---

### POST-PUB-009: Should have meta description ⏸️ SKIPPED

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
@in-development
Scenario: Meta description exists

Given I am on a published post page
When the post loads completely
Then a meta description tag should exist in head
```

**Status:** Skipped - SEO meta tags implementation pending.

</td>
<td>

```gherkin
@in-development
Scenario: Meta descripcion existe

Given estoy en una pagina de post publicado
When el post carga completamente
Then una etiqueta meta description deberia existir en head
```

**Estado:** Omitido - Implementacion de meta tags SEO pendiente.

</td>
</tr>
</table>

---

### POST-PUB-010: Should have OG tags for social sharing ⏸️ SKIPPED

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
@in-development
Scenario: Open Graph tags exist

Given I am on a published post page
When the post loads completely
Then Open Graph meta tags should exist
And there should be at least 1 og: property
```

**Status:** Skipped - SEO meta tags implementation pending.

</td>
<td>

```gherkin
@in-development
Scenario: Etiquetas Open Graph existen

Given estoy en una pagina de post publicado
When el post carga completamente
Then las etiquetas meta Open Graph deberian existir
And deberia haber al menos 1 propiedad og:
```

**Estado:** Omitido - Implementacion de meta tags SEO pendiente.

</td>
</tr>
</table>

---

## Unpublished Posts

### POST-PUB-011: Should not display unpublished posts

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Unpublished posts are not accessible

Given there is a draft post "typescript-best-practices"
When I try to visit the post at /blog/typescript-best-practices
Then the page should show a 404 error
Or the page should contain "not found" text
```

**Security Verification:**
Draft posts must never be accessible publicly.

</td>
<td>

```gherkin
Scenario: Posts no publicados no son accesibles

Given existe un post borrador "typescript-best-practices"
When intento visitar el post en /blog/typescript-best-practices
Then la pagina deberia mostrar un error 404
Or la pagina deberia contener texto "not found"
```

**Verificacion de Seguridad:**
Los posts borrador nunca deben ser accesibles publicamente.

</td>
</tr>
</table>

---

## 404 Not Found

### POST-PUB-012: Should show 404 for non-existent post

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Non-existent post shows 404

Given there is no post with slug "non-existent-post-slug-12345"
When I try to visit /blog/non-existent-post-slug-12345
Then the page should show a 404 error
Or the page should contain "not found" text
```

</td>
<td>

```gherkin
Scenario: Post no existente muestra 404

Given no existe un post con slug "non-existent-post-slug-12345"
When intento visitar /blog/non-existent-post-slug-12345
Then la pagina deberia mostrar un error 404
Or la pagina deberia contener texto "not found"
```

</td>
</tr>
</table>

---

## Featured Image

### POST-PUB-013: Should display featured image when present

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Featured image displays when available

Given I am on a published post
When the post loads completely
And the post has a featured image
Then the featured image should be visible in the header

But if the post has no featured image
Then it should still render without error
```

**Note:** Featured image is an optional field.

</td>
<td>

```gherkin
Scenario: Imagen destacada se muestra cuando esta disponible

Given estoy en un post publicado
When el post carga completamente
And el post tiene una imagen destacada
Then la imagen destacada deberia estar visible en el encabezado

But si el post no tiene imagen destacada
Then deberia renderizar sin error igualmente
```

**Nota:** La imagen destacada es un campo opcional.

</td>
</tr>
</table>

---

## UI Elements / Elementos UI

### Post Structure

| Element | Selector | Description / Descripción |
|---------|----------|---------------------------|
| Post Container | `[data-cy="public-post"]` | Main post container |
| Post Header | `[data-cy="post-header"]` | Header section |
| Post Title | `[data-cy="post-title"]` | Post title heading |
| Post Excerpt | `[data-cy="post-excerpt"]` | Post excerpt/summary |
| Post Content | `[data-cy="post-content"]` | Main content area |
| Featured Image | `[data-cy="post-featured-image"]` | Featured image |

### Category Elements

| Element | Selector | Description / Descripción |
|---------|----------|---------------------------|
| Categories Display | `[data-cy="post-categories"]` | Categories container |
| Category Badge | `[data-cy="category-badge-*"]` | Individual category badge |

---

## Summary / Resumen

| Test ID | Block | Description / Descripción | Status | Tags |
|---------|-------|---------------------------|--------|------|
| POST-PUB-001 | Post Rendering | Render published post | Active | `@smoke` |
| POST-PUB-002 | Post Rendering | Display header | Active | |
| POST-PUB-003 | Post Rendering | Display excerpt | Active | |
| POST-PUB-004 | Block Rendering | Render blocks | Active | |
| POST-PUB-005 | Block Rendering | Render hero | Active | |
| POST-PUB-006 | Categories | Display badges | Active | |
| POST-PUB-007 | Categories | Badges with colors | Active | |
| POST-PUB-008 | SEO | Page title | ⏸️ Skip | `@in-development` |
| POST-PUB-009 | SEO | Meta description | ⏸️ Skip | `@in-development` |
| POST-PUB-010 | SEO | OG tags | ⏸️ Skip | `@in-development` |
| POST-PUB-011 | Access Control | Not display unpublished | Active | |
| POST-PUB-012 | Error Handling | 404 for non-existent | Active | |
| POST-PUB-013 | Media | Featured image | Active | |
