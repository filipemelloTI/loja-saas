import { describe, it, expect } from 'vitest'
import { destinoAposLogin } from '@/lib/destino'
import type { Contexto } from '@/lib/contexto'

const loja = { id: 'l1', nome: 'Loja', modulos: ['servico' as const], situacao: 'em_dia' as const }
const membro = { id: 'm1', nome: 'Ana', perfil: 'dono' as const, ativo: true }
const base: Contexto = { userId: 'u1', adminPlataforma: false, membro, loja, emSuporte: false }
const com = (p: Partial<Contexto>): Contexto => ({ ...base, ...p })

describe('destinoAposLogin', () => {
  it('não logado em rota privada vai para /login', () => {
    expect(destinoAposLogin(null, '/')).toBe('/login')
    expect(destinoAposLogin(null, '/configuracoes')).toBe('/login')
  })
  it('não logado segue em /login, /definir-senha e /acompanhar/*', () => {
    expect(destinoAposLogin(null, '/login')).toBeNull()
    expect(destinoAposLogin(null, '/definir-senha')).toBeNull()
    expect(destinoAposLogin(null, '/acompanhar/abc123')).toBeNull()
  })
  it('admin sem suporte fora de /plataforma vai para /plataforma', () => {
    const adm = com({ adminPlataforma: true, membro: null, loja: null })
    expect(destinoAposLogin(adm, '/')).toBe('/plataforma')
    expect(destinoAposLogin(adm, '/estoque')).toBe('/plataforma')
  })
  it('admin sem loja em /plataforma segue', () => {
    const adm = com({ adminPlataforma: true, membro: null, loja: null })
    expect(destinoAposLogin(adm, '/plataforma')).toBeNull()
    expect(destinoAposLogin(adm, '/plataforma/lojas/1')).toBeNull()
  })
  it('admin em suporte pode acessar rotas da loja', () => {
    const sup = com({ adminPlataforma: true, membro: null, emSuporte: true })
    expect(destinoAposLogin(sup, '/')).toBeNull()
    expect(destinoAposLogin(sup, '/estoque')).toBeNull()
  })
  it('loja suspensa em /configuracoes vai para /suspensa', () => {
    const susp = com({ loja: { ...loja, situacao: 'suspensa' } })
    expect(destinoAposLogin(susp, '/configuracoes')).toBe('/suspensa')
  })
  it('loja suspensa com membro invisível pela RLS ainda vai para /suspensa', () => {
    expect(destinoAposLogin(com({ membro: null, loja: { ...loja, situacao: 'suspensa' } }), '/')).toBe('/suspensa')
  })
  it('loja suspensa em /suspensa segue', () => {
    const susp = com({ loja: { ...loja, situacao: 'suspensa' } })
    expect(destinoAposLogin(susp, '/suspensa')).toBeNull()
  })
  it('loja atrasada continua liberada', () => {
    expect(destinoAposLogin(com({ loja: { ...loja, situacao: 'atrasado' } }), '/')).toBeNull()
  })
  it('membro inativo vai para /sem-acesso', () => {
    expect(destinoAposLogin(com({ membro: { ...membro, ativo: false } }), '/')).toBe('/sem-acesso')
  })
  it('logado sem membro e sem loja vai para /sem-acesso', () => {
    expect(destinoAposLogin(com({ membro: null, loja: null }), '/')).toBe('/sem-acesso')
  })
  it('em /sem-acesso sem membro segue', () => {
    expect(destinoAposLogin(com({ membro: null, loja: null }), '/sem-acesso')).toBeNull()
  })
  it('dono em / segue', () => {
    expect(destinoAposLogin(base, '/')).toBeNull()
  })
  it('técnico em /plataforma vai para /', () => {
    const tec = com({ membro: { ...membro, perfil: 'tecnico' } })
    expect(destinoAposLogin(tec, '/plataforma')).toBe('/')
  })
  it('usuário válido em /login, /suspensa ou /sem-acesso volta para /', () => {
    expect(destinoAposLogin(base, '/login')).toBe('/')
    expect(destinoAposLogin(base, '/suspensa')).toBe('/')
    expect(destinoAposLogin(base, '/sem-acesso')).toBe('/')
  })
  it('/definir-senha e /acompanhar/* seguem mesmo logado', () => {
    expect(destinoAposLogin(base, '/definir-senha')).toBeNull()
    expect(destinoAposLogin(base, '/acompanhar/x')).toBeNull()
  })
})
