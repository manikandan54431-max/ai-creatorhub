/**
 * Lightweight HTTP helpers for Playwright test setup/teardown.
 * Uses native fetch — no axios, no imports needed beyond this file.
 */
const API = 'http://localhost:8000'

async function _req(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${method} ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

export const apiLogin = (email, password) =>
  _req('POST', '/api/auth/login', { email, password })

export const apiRegister = (name, email, password, role = 'client') =>
  _req('POST', '/api/auth/register', { name, email, password, role })

export const apiGet = (path, token) => _req('GET', path, undefined, token)

export const apiPost = (path, body, token) => _req('POST', path, body, token)

export const apiPut = (path, body, token) => _req('PUT', path, body, token)

export const apiDelete = (path, token) => _req('DELETE', path, undefined, token)
