import { expect, test, type Page } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_SENHA, PLANO_E2E } from './global-setup'

/**
 * Teste ponta a ponta da fundação, contra o Supabase local + `next dev`.
 * Usa os fluxos reais (sem stub): login, criar loja no painel, definir senha pelo link,
 * desligar módulo, criar técnico. O que o teste precisa (admin e plano) é garantido no
 * globalSetup via service role, então não depende de usuário criado à mão.
 *
 * É um fluxo encadeado (a loja e o Dono criados servem os três passos), então roda num
 * único teste, em ordem. O menu é conferido na barra lateral (visível no desktop).
 */

const SENHA = 'senha-forte-123'
const run = Date.now()
const emailDono = `dono.${run}@e2e.test`
const emailTecnico = `tecnico.${run}@e2e.test`

/** Barra lateral do shell da loja (a do desktop, sempre visível na largura de teste). */
function menuLateral(page: Page) {
  return page.locator('aside nav[aria-label="Menu principal"]')
}

/**
 * Formulários client (nova loja, usuários, editar loja) usam onSubmit+preventDefault,
 * que só vale depois da hidratação. Clicar antes disso dispara o submit nativo (GET).
 * Espera a rede acalmar e dá uma folga para o React assumir o form.
 */
async function enviarHidratado(page: Page, nomeBotao: string) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: nomeBotao }).click()
}

async function entrar(page: Page, email: string, senha: string) {
  // Começa sem sessão: com uma sessão ativa o proxy tira a gente de /login.
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/**
 * Abre o link REAL gerado pela UI, define a senha e espera cair no shell da loja.
 * Sem fallback: é o link da própria tela que precisa funcionar. O token é de uso único e
 * o efeito de definir-senha tem trava para rodar o verifyOtp só uma vez (inclusive no
 * Strict Mode de dev), então o formulário aparece e permanece.
 */
async function definirSenhaPeloLink(page: Page, linkUI: string, senha: string) {
  const campoSenha = page.getByLabel('Nova senha (mínimo 8 caracteres)')
  await page.goto(linkUI)
  // O formulário só aparece (e permanece) depois do verifyOtp (estado "pronto").
  await expect(campoSenha).toBeVisible()
  await page.waitForTimeout(500) // confirma que o 2º efeito do Strict Mode não derruba o form
  await expect(campoSenha).toBeVisible()

  await campoSenha.fill(senha)
  await page.getByLabel('Repita a senha').fill(senha)
  await page.getByRole('button', { name: 'Salvar senha' }).click()
  // Sai de /definir-senha (vai para o shell da loja, '/').
  await expect(page).not.toHaveURL(/\/definir-senha/)
}

test('fundação ponta a ponta: loja, senha, módulos e perfis', async ({ page }) => {
  const nomeLoja = `Loja E2E ${run}`
  let linkDono = ''
  let urlLoja = ''

  await test.step('admin cria loja e gera o link do Dono', async () => {
    await entrar(page, ADMIN_EMAIL, ADMIN_SENHA)
    // O admin cai no painel; a navegação explícita abaixo já confirma o acesso.
    await page.goto('/plataforma/lojas/nova')
    // O seletor de plano e os checkboxes são controlados pelo React: só mexer depois
    // da hidratação, senão o React redefine o estado para o do plano inicial.
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)
    await page.getByLabel('Nome da loja').fill(nomeLoja)

    // Escolhe o plano com todos os módulos pelo value (independe do texto do rótulo).
    const seletor = page.locator('#campo-planoId')
    const valorPlano = await seletor.locator('option', { hasText: PLANO_E2E }).first().getAttribute('value')
    expect(valorPlano, `plano "${PLANO_E2E}" na lista`).toBeTruthy()
    await seletor.selectOption(valorPlano!)

    await page.getByLabel('Nome do Dono').fill('Dona E2E')
    await page.getByLabel('E-mail do Dono').fill(emailDono)
    await enviarHidratado(page, 'Criar loja')

    linkDono = await page.getByLabel('Link para definir senha').inputValue()
    expect(linkDono).toContain('/definir-senha?token_hash=')
  })

  await test.step('Dono define a senha e vê "Configurações" no menu', async () => {
    await definirSenhaPeloLink(page, linkDono, SENHA)
    await expect(menuLateral(page).getByRole('link', { name: 'Configurações' })).toBeVisible()
    // Com todos os módulos, Fornecedores aparece neste momento.
    await expect(menuLateral(page).getByRole('link', { name: 'Fornecedores' })).toBeVisible()
  })

  await test.step('admin desliga Fornecedores e o menu do Dono deixa de mostrar', async () => {
    await entrar(page, ADMIN_EMAIL, ADMIN_SENHA)
    // Abre a loja pela lista (link com o nome dela).
    await page.goto('/plataforma')
    await page.getByRole('link', { name: nomeLoja }).click()
    await expect(page).toHaveURL(/\/plataforma\/lojas\//)
    urlLoja = page.url()

    // Desmarca só Fornecedores (os outros módulos continuam válidos) e salva.
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)
    await page.getByRole('checkbox', { name: 'Fornecedores' }).uncheck()
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(page.getByText('Alterações salvas.')).toBeVisible()

    // Dono entra de novo: menu sem Fornecedores, Configurações segue lá.
    await entrar(page, emailDono, SENHA)
    await expect(menuLateral(page).getByRole('link', { name: 'Configurações' })).toBeVisible()
    await expect(menuLateral(page).getByRole('link', { name: 'Fornecedores' })).toHaveCount(0)
  })

  await test.step('Dono cria técnico; técnico entra e vê só o menu do perfil', async () => {
    // Já logado como Dono (passo anterior). Vai em Configurações › Usuários.
    await page.goto('/configuracoes/usuarios')
    await page.getByLabel('Nome', { exact: true }).fill('Técnico E2E')
    await page.getByLabel('E-mail', { exact: true }).fill(emailTecnico)
    await page.getByLabel('Perfil').selectOption('tecnico')
    await enviarHidratado(page, 'Cadastrar usuário')

    const linkTecnico = await page.getByLabel('Link para definir senha').inputValue()
    expect(linkTecnico).toContain('/definir-senha?token_hash=')

    await definirSenhaPeloLink(page, linkTecnico, SENHA)

    // Menu do técnico é exatamente Início, Serviço, Clientes, Estoque.
    await expect(menuLateral(page).getByRole('link')).toHaveText(['Início', 'Serviço', 'Clientes', 'Estoque'])
  })

  // Evita variável não usada caso o passo acima mude; registra a loja tocada.
  expect(urlLoja).toContain('/plataforma/lojas/')
})
