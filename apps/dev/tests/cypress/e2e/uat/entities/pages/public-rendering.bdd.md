# Public Page Rendering (Format: BDD/Gherkin - Bilingual)

> **Test File:** `page-rendering.cy.ts`
> **Format:** Behavior-Driven Development (BDD) with Given/When/Then
> **Languages:** English / Spanish (side-by-side)
> **Total Tests:** 15

---

## Feature: Public Page Rendering

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

As a **public visitor**
I want to **view published pages with their blocks**
So that **I can access the website content**

**Key Functionality:**
- Published pages render correctly
- Blocks display with content
- Draft pages return 404
- SEO metadata is present
- i18n support works

</td>
<td>

Como **visitante publico**
Quiero **ver paginas publicadas con sus bloques**
Para **acceder al contenido del sitio web**

**Funcionalidad Clave:**
- Paginas publicadas renderizan correctamente
- Bloques se muestran con contenido
- Paginas borrador retornan 404
- Metadatos SEO estan presentes
- Soporte i18n funciona

</td>
</tr>
</table>

---

## Published Page Rendering

### PB_PUBLIC_001: Should render published page with HTTP 200 `@smoke`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Published page renders successfully

Given there is a published page "about-us" in sample data
When I visit the page at /about-us
Then the page should load successfully
And the page should have the correct slug attribute
And the page container should be visible
```

</td>
<td>

```gherkin
Scenario: Pagina publicada renderiza exitosamente

Given existe una pagina publicada "about-us" en datos de ejemplo
When visito la pagina en /about-us
Then la pagina deberia cargar exitosamente
And la pagina deberia tener el atributo slug correcto
And el contenedor de pagina deberia estar visible
```

</td>
</tr>
</table>

---

### PB_PUBLIC_002: Should display Hero block with content

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Hero block renders with content

Given I am on a published page
When the page loads completely
Then the Hero block should be visible
And the Hero title should exist
```

</td>
<td>

```gherkin
Scenario: Bloque Hero renderiza con contenido

Given estoy en una pagina publicada
When la pagina carga completamente
Then el bloque Hero deberia estar visible
And el titulo del Hero deberia existir
```

</td>
</tr>
</table>

---

### PB_PUBLIC_003: Should display Features Grid block

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Features Grid block renders

Given I am on a published page with Features Grid
When the page loads completely
Then the Features Grid block should be visible
```

</td>
<td>

```gherkin
Scenario: Bloque Features Grid renderiza

Given estoy en una pagina publicada con Features Grid
When la pagina carga completamente
Then el bloque Features Grid deberia estar visible
```

</td>
</tr>
</table>

---

### PB_PUBLIC_004: Should display CTA Section block

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: CTA Section block renders

Given I am on a published page with CTA Section
When the page loads completely
Then the CTA Section block should be visible
```

</td>
<td>

```gherkin
Scenario: Bloque CTA Section renderiza

Given estoy en una pagina publicada con CTA Section
When la pagina carga completamente
Then el bloque CTA Section deberia estar visible
```

</td>
</tr>
</table>

---

### PB_PUBLIC_005: Should display Testimonials block

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Testimonials block renders

Given I am on a published page with Testimonials
When the page loads completely
Then the Testimonials block should be visible
```

</td>
<td>

```gherkin
Scenario: Bloque Testimonials renderiza

Given estoy en una pagina publicada con Testimonials
When la pagina carga completamente
Then el bloque Testimonials deberia estar visible
```

</td>
</tr>
</table>

---

### PB_PUBLIC_006: Should display all expected blocks

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: All expected blocks render on page

Given I am on a published page with multiple blocks
And the page has expected blocks defined in fixtures
When the page loads completely
Then all expected blocks should be rendered
And the block count should match expectations
```

</td>
<td>

```gherkin
Scenario: Todos los bloques esperados renderizan en pagina

Given estoy en una pagina publicada con multiples bloques
And la pagina tiene bloques esperados definidos en fixtures
When la pagina carga completamente
Then todos los bloques esperados deberian renderizar
And la cantidad de bloques deberia coincidir con expectativas
```

</td>
</tr>
</table>

---

## Draft Page Handling

### PB_PUBLIC_007: Should return 404 for draft page

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Draft pages are not publicly accessible

Given I create a draft page via API with published=false
When I try to access the draft page publicly
Then the response should be 404
And the page content should not be visible

When I cleanup by deleting the draft page
Then the page should be removed
```

**Security Verification:**
Draft pages must never be accessible to public visitors.

</td>
<td>

```gherkin
Scenario: Paginas borrador no son accesibles publicamente

Given creo una pagina borrador via API con published=false
When intento acceder a la pagina borrador publicamente
Then la respuesta deberia ser 404
And el contenido de la pagina no deberia ser visible

When limpio eliminando la pagina borrador
Then la pagina deberia ser removida
```

**Verificacion de Seguridad:**
Las paginas borrador nunca deben ser accesibles a visitantes publicos.

</td>
</tr>
</table>

---

## SEO Metadata

### PB_PUBLIC_008: Should have correct meta title

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Page has meta title

Given I am on a published page
When the page loads completely
Then the page title should not be empty
And the title tag should contain relevant content
```

</td>
<td>

```gherkin
Scenario: Pagina tiene meta titulo

Given estoy en una pagina publicada
When la pagina carga completamente
Then el titulo de la pagina no deberia estar vacio
And la etiqueta title deberia contener contenido relevante
```

</td>
</tr>
</table>

---

### PB_PUBLIC_009: Should have meta description

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Page has meta description

Given I am on a published page
When the page loads completely
Then a meta description tag should exist
And the description should provide page summary
```

</td>
<td>

```gherkin
Scenario: Pagina tiene meta descripcion

Given estoy en una pagina publicada
When la pagina carga completamente
Then una etiqueta meta description deberia existir
And la descripcion deberia proveer resumen de pagina
```

</td>
</tr>
</table>

---

## Internationalization

### PB_PUBLIC_010: Should render Spanish version of page `@i18n`

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Spanish page version renders

Given there is a Spanish version of a page
When I visit the Spanish locale path /es/{slug}
Or I visit the root path if Spanish is default
Then the page should render successfully
And the content should be in Spanish
```

**Note:** Spanish page may be at /es/{slug} or root depending on locale config.

</td>
<td>

```gherkin
Scenario: Version en espanol de pagina renderiza

Given existe una version en espanol de una pagina
When visito la ruta de locale espanol /es/{slug}
Or visito la ruta raiz si espanol es el default
Then la pagina deberia renderizar exitosamente
And el contenido deberia estar en espanol
```

**Nota:** La pagina en espanol puede estar en /es/{slug} o raiz segun config de locale.

</td>
</tr>
</table>

---

## Block Interactions

### PB_PUBLIC_011: Should have clickable CTA button

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: CTA button is interactive

Given I am on a published page with CTA Section
When the page loads completely
And the CTA section is visible
Then the primary CTA button should have an href attribute
And the button should be clickable
```

</td>
<td>

```gherkin
Scenario: Boton CTA es interactivo

Given estoy en una pagina publicada con CTA Section
When la pagina carga completamente
And la seccion CTA esta visible
Then el boton CTA primario deberia tener un atributo href
And el boton deberia ser clickeable
```

</td>
</tr>
</table>

---

### PB_PUBLIC_012: Should have clickable Hero CTA

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Hero CTA button is interactive

Given I am on a published page with Hero block
When the page loads completely
And the Hero block is visible
Then the Hero CTA button should have an href attribute (if present)
```

</td>
<td>

```gherkin
Scenario: Boton CTA del Hero es interactivo

Given estoy en una pagina publicada con bloque Hero
When la pagina carga completamente
And el bloque Hero esta visible
Then el boton CTA del Hero deberia tener un atributo href (si esta presente)
```

</td>
</tr>
</table>

---

## Page Structure

### PB_PUBLIC_013: Should have correct page data attributes

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Page has correct data attributes

Given I am on a published page
When the page loads completely
Then an element with data-page-id should exist
And an element with data-page-slug should exist
And the slug attribute should match the URL slug
```

</td>
<td>

```gherkin
Scenario: Pagina tiene atributos data correctos

Given estoy en una pagina publicada
When la pagina carga completamente
Then un elemento con data-page-id deberia existir
And un elemento con data-page-slug deberia existir
And el atributo slug deberia coincidir con el slug de URL
```

</td>
</tr>
</table>

---

### PB_PUBLIC_014: Should have block data attributes

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Blocks have data attributes

Given I am on a published page with blocks
When the page loads completely
Then elements with data-block-id should exist
And elements with data-block-slug should exist
And there should be at least 1 block with data attributes
```

</td>
<td>

```gherkin
Scenario: Bloques tienen atributos data

Given estoy en una pagina publicada con bloques
When la pagina carga completamente
Then elementos con data-block-id deberian existir
And elementos con data-block-slug deberian existir
And deberia haber al menos 1 bloque con atributos data
```

</td>
</tr>
</table>

---

## Performance

### PB_PUBLIC_015: Should load page within reasonable time

<table>
<tr>
<th width="50%">English</th>
<th width="50%">Español</th>
</tr>
<tr>
<td>

```gherkin
Scenario: Page loads within performance threshold

Given I am about to visit a published page
When I start timing the page load
And I visit and wait for the page to load
Then the total load time should be less than 5000ms
```

**Performance Target:** Page should load within 5 seconds.

</td>
<td>

```gherkin
Scenario: Pagina carga dentro de umbral de rendimiento

Given estoy por visitar una pagina publicada
When inicio el cronometro de carga de pagina
And visito y espero que la pagina cargue
Then el tiempo total de carga deberia ser menor a 5000ms
```

**Objetivo de Rendimiento:** La pagina deberia cargar en menos de 5 segundos.

</td>
</tr>
</table>

---

## UI Elements / Elementos UI

### Page Structure

| Element | Selector | Description / Descripción |
|---------|----------|---------------------------|
| Page Container | `[data-page-id]` | Main page container |
| Page Slug | `[data-page-slug]` | Element with slug attribute |
| Block Container | `[data-block-id]` | Individual block container |
| Block Slug | `[data-block-slug]` | Block type identifier |

### Block Components

| Element | Selector | Description / Descripción |
|---------|----------|---------------------------|
| Hero Section | `[data-block-slug="hero"]` | Hero block |
| Hero Title | Hero section h1/h2 | Main hero heading |
| Hero CTA | Hero button with href | Call-to-action button |
| Features Grid | `[data-block-slug="features"]` | Features section |
| CTA Section | `[data-block-slug="cta"]` | CTA block |
| CTA Button | CTA button with href | Primary CTA |
| Testimonials | `[data-block-slug="testimonials"]` | Testimonials section |

### SEO Elements

| Element | Selector | Description / Descripción |
|---------|----------|---------------------------|
| Page Title | `title` | HTML title tag |
| Meta Description | `meta[name="description"]` | SEO description |

---

## Summary / Resumen

| Test ID | Block | Description / Descripción | Tags |
|---------|-------|---------------------------|------|
| PB_PUBLIC_001 | Published Page | Render with HTTP 200 | `@smoke` |
| PB_PUBLIC_002 | Published Page | Display Hero block | |
| PB_PUBLIC_003 | Published Page | Display Features Grid | |
| PB_PUBLIC_004 | Published Page | Display CTA Section | |
| PB_PUBLIC_005 | Published Page | Display Testimonials | |
| PB_PUBLIC_006 | Published Page | Display all expected blocks | |
| PB_PUBLIC_007 | Draft Page | Return 404 for draft | |
| PB_PUBLIC_008 | SEO | Correct meta title | |
| PB_PUBLIC_009 | SEO | Meta description | |
| PB_PUBLIC_010 | i18n | Spanish version | `@i18n` |
| PB_PUBLIC_011 | Interactions | Clickable CTA button | |
| PB_PUBLIC_012 | Interactions | Clickable Hero CTA | |
| PB_PUBLIC_013 | Structure | Page data attributes | |
| PB_PUBLIC_014 | Structure | Block data attributes | |
| PB_PUBLIC_015 | Performance | Load within 5s | |
