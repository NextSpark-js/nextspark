/**
 * Guards against hardcoded Spanish creeping back into the shipped code.
 *
 * Extracts string literals and JSX text (comments stripped first, since
 * comments are allowed to be in any language) from packages/core/src and
 * apps/dev/src/app, and flags anything that looks like Spanish: ñ, inverted
 * punctuation, an accented -ción/-sión, or a Spanish word with no English
 * reading, after resolving the escapes and entities a literal may be written in. The word list stays conservative — every entry
 * must be unambiguously Spanish-only — to keep the false-positive rate low
 * enough for this to run unattended in CI.
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CORE_SRC = path.resolve(__dirname, '../../src')
const APPS_DEV_APP = path.resolve(__dirname, '../../../../apps/dev/src/app')

// Spanish shows through ñ, ¿ or ¡, an accented -ción/-sión, or a word with no
// English reading. An accent alone is not enough: "Renée" or "Café" are English
// copy. Words are matched against the text with its accents stripped, so a
// string written without them ("Ultimos 7 dias") is caught too.
const SPANISH_MARKS = /[ñÑ¿¡]|(?:ción|sión)\b/i
// Unambiguously Spanish-only words (none of these are also valid English words),
// written without accents and matched as whole words. Short or overloaded tokens
// ("si", "no", "es") stay out: they false-positive on ISO codes and identifiers.
const SPANISH_WORDS =
  /\b(actualizando|actualizado|actualizada|cargando|guardando|guardado|enviando|enviado|creando|eliminando|eliminado|procesando|procesado|exitosamente|correctamente|minutos?|segundos?|dias|semanas|meses|atras|ahora|recien|nuevo|nueva|nuevos|nuevas|usuario|usuarios|sesion|sesiones|contrasena|correo|telefono|direccion|ciudad|pais|guardar|cancelar|eliminar|confirmar|enviar|buscar|cerrar|abrir|mostrar|ocultar|siguiente|anterior|todos|todas|ninguno|ninguna|cargar|exito|advertencia|cuenta|perfil|configuracion|seguridad|notificacion|notificaciones|facturacion|permiso|permisos|equipo|equipos|miembro|miembros|archivo|archivos|imagen|imagenes|cambiar|cambios|escribiendo|escribe|ingresa|selecciona|seleccionar|seleccionado|seleccionados|editar|borrar|agregar|anadir|invitar|pendiente|pendientes|completado|completada|fallido|fallo|incorrecta|invalido|invalida|requerido|requerida|obligatorio|obligatoria|opcional|disponible|deshabilitado|habilitado|activo|inactivo|volver|regresar|continuar|finalizar|terminar|iniciar|comenzar|empezar|aceptar|rechazar|aprobar|denegar|advertir|alerta|aviso|mensaje|campo|formulario|boton|pagina|enlace|vinculo|revisa|revisar|funcionalidad|requiere|mejora|copiado|copiar|descargar|subir|arrastra|suelta|clic|numero|codigo|clave|acceso|salir|entrar|olvidaste|recuperar|restablecer|expirado|vencido|valido|falta|faltan|completa|completar|verificar|verificacion|reenviar|intentalo|intento|intentos|bloqueado|bloquear|apellido|bienvenido|bienvenida|encontrado|encontrada|encontrados|encontradas|vacio|vacia|listo|lista|inesperado|inesperada|detalles|desconocido|desconocida|ultimos|ultimas|tasa|basica|basico|recurso|recursos|recuperacion|revocar|revocado|entendido|activar|desactivar|activado|desactivado|habilitar|deshabilitar|ver|nombre|estado|datos|estadisticas|no hay)\b/i

// Proper nouns and endonyms that are correct as-is in English copy — not a
// translation left behind, just the right word in any language.
const ALLOWLIST = new Set([
  'Bogotá (GMT-5)', // timezone-select.tsx: city name, spelled the same in English
  'Venezuelan Bolívar', // currency-select.tsx: the currency's actual English name
  'Español', // language picker: the endonym for Spanish, like "Français"/"Português"
  'Córdoba, Argentina', // security settings mock session data: a city name
])

const HTML_ENTITIES: Record<string, string> = {
  ntilde: 'ñ', Ntilde: 'Ñ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', iquest: '¿', iexcl: '¡',
}

/** The character a code point names, or the escape as written when it names none. */
function charOrLiteral(literal: string, code: number): string {
  return code <= 0x10ffff ? String.fromCodePoint(code) : literal
}

/** The text a literal renders: \u, \u{} and \x escapes and named or numeric HTML entities resolved. */
function decodeLiteral(value: string): string {
  return value
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (literal, hex: string) => charOrLiteral(literal, parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#[xX]([0-9a-fA-F]+);?/g, (literal, hex: string) => charOrLiteral(literal, parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (literal, dec: string) => charOrLiteral(literal, parseInt(dec, 10)))
    .replace(/&([A-Za-z]+);/g, (entity, name: string) => HTML_ENTITIES[name] ?? entity)
}

function isSpanish(value: string): boolean {
  if (!value) return false
  const text = decodeLiteral(value)
  if (ALLOWLIST.has(value) || ALLOWLIST.has(text)) return false
  if (SPANISH_MARKS.test(text)) return true
  return SPANISH_WORDS.test(text.normalize('NFD').replace(/[̀-ͯ]/g, ''))
}

/** Blanks out // and /* comments, leaving string/template literals untouched. */
function stripComments(src: string): string {
  let out = ''
  let i = 0
  const n = src.length
  type State = 'code' | 'line-comment' | 'block-comment' | 'sq' | 'dq' | 'tpl'
  let state: State = 'code'
  while (i < n) {
    const c = src[i]
    const c2 = src[i + 1]
    if (state === 'code') {
      if (c === '/' && c2 === '/') { state = 'line-comment'; out += '  '; i += 2; continue }
      if (c === '/' && c2 === '*') { state = 'block-comment'; out += '  '; i += 2; continue }
      if (c === "'") { state = 'sq'; out += c; i++; continue }
      if (c === '"') { state = 'dq'; out += c; i++; continue }
      if (c === '`') { state = 'tpl'; out += c; i++; continue }
      out += c; i++; continue
    }
    if (state === 'line-comment') {
      if (c === '\n') { state = 'code'; out += '\n'; i++; continue }
      out += ' '; i++; continue
    }
    if (state === 'block-comment') {
      if (c === '*' && c2 === '/') { state = 'code'; out += '  '; i += 2; continue }
      out += c === '\n' ? '\n' : ' '; i++; continue
    }
    if (state === 'sq' || state === 'dq') {
      const quote = state === 'sq' ? "'" : '"'
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue }
      if (c === quote) { state = 'code'; out += c; i++; continue }
      out += c; i++; continue
    }
    if (state === 'tpl') {
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue }
      if (c === '`') { state = 'code'; out += c; i++; continue }
      out += c; i++; continue
    }
  }
  return out
}

function extractStrings(codeNoComments: string): string[] {
  const out: string[] = []
  const re = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g
  let m: RegExpExecArray | null
  while ((m = re.exec(codeNoComments))) {
    const s = m[1] ?? m[2] ?? m[3]
    if (s) out.push(s)
  }
  return out
}

/** JSX text nodes: whatever sits between `>` and `<` with no nested tag or expression. */
function extractJsxText(codeNoComments: string): string[] {
  const out: string[] = []
  const re = />([^<>{}]+)</g
  let m: RegExpExecArray | null
  while ((m = re.exec(codeNoComments))) {
    const s = m[1].replace(/\s+/g, ' ').trim()
    if (s) out.push(s)
  }
  return out
}

const SKIP_DIR_NAMES = new Set(['node_modules', '.next', '.nextspark', 'dist', 'messages'])
// This template set renders bilingual security emails keyed by ctx.locale (see
// lib/auth/security-notifications/templates/shared.ts): the `es` copy is real,
// intentional Spanish shown only to es-locale users, not a leftover
// translation — the same reason packages/core/src/messages/** is excluded.
const SKIP_PATH_SEGMENTS = [path.join('lib', 'auth', 'security-notifications', 'templates')]

function shouldSkipDir(fullPath: string): boolean {
  const base = path.basename(fullPath)
  if (SKIP_DIR_NAMES.has(base)) return true
  return SKIP_PATH_SEGMENTS.some((seg) => fullPath.endsWith(seg) || fullPath.includes(`${seg}${path.sep}`))
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      if (shouldSkipDir(full)) continue
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

interface Finding {
  file: string
  kind: 'string' | 'jsx'
  text: string
}

function findSpanish(root: string): Finding[] {
  const findings: Finding[] = []
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, 'utf8')
    const stripped = stripComments(src)
    const relFile = path.relative(process.cwd(), file)
    for (const s of extractStrings(stripped)) {
      if (isSpanish(s)) findings.push({ file: relFile, kind: 'string', text: s.slice(0, 140) })
    }
    for (const s of extractJsxText(stripped)) {
      if (isSpanish(s)) findings.push({ file: relFile, kind: 'jsx', text: s.slice(0, 140) })
    }
  }
  return findings
}

function formatFindings(findings: Finding[]): string {
  return findings.map((f) => `  ${f.file} [${f.kind}] ${JSON.stringify(f.text)}`).join('\n')
}

describe('no hardcoded Spanish in shipped code', () => {
  test('the detector flags Spanish however it is written, and leaves accented English alone', () => {
    for (const spanish of ['Error inesperado', 'Contrase\\u00f1a', 'Contrase\\u{00f1}a', 'Contrase&#241;a', 'Contrase&#xF1;a', 'A&ntilde;adir elemento', 'Detalles de ${name}', 'Ultimos 7 dias', 'Revocar', 'Entendido', 'Activar', 'Desactivar', 'Ver planes', 'No hay datos', 'Nombre', 'Estado', 'Estadísticas de uso', 'Contrase&#XF1;a', 'Contrase&#241a']) {
      assert.equal(isSpanish(spanish), true, spanish)
    }
    for (const english of ['documentation example: &#9999999999; &#x110000;', 'Renée Hall', 'Café menu', 'Session Config', 'Permission denied', 'Venezuelan Bolívar']) {
      assert.equal(isSpanish(english), false, english)
    }
  })

  test('packages/core/src has no hardcoded Spanish outside messages/', () => {
    const findings = findSpanish(CORE_SRC)
    assert.equal(findings.length, 0, `Found hardcoded Spanish:\n${formatFindings(findings)}`)
  })

  test('apps/dev/src/app has no hardcoded Spanish', () => {
    if (!fs.existsSync(APPS_DEV_APP)) return
    const findings = findSpanish(APPS_DEV_APP)
    assert.equal(findings.length, 0, `Found hardcoded Spanish:\n${formatFindings(findings)}`)
  })
})
