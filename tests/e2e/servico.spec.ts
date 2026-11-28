import { expect, test, type Page } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_SENHA, PLANO_E2E } from './global-setup'
// Só tipos e tabelas puras: o rótulo dos botões vem do código, não de texto copiado para cá.
import { avancosDe, ROTULO_STATUS, type StatusOS } from '../../src/lib/os-status'

/**
 * Teste ponta a ponta da Fase A do Serviço (OS), contra o Supabase local + `next dev`, sem stub.
 * Dono cadastra cliente (com máscara) → acha por dígitos → abre OS com checklist e senha → vê na
 * lista → confere o detalhe e a senha sob demanda → avança até `entregue` → confere o histórico e a
 * OS encerrada. Depois, um técnico não recebe o bloco "Voltar etapa" (o Dono recebe).
 *
 * Fluxo encadeado num único teste, como `fundacao.spec.ts`. A loja e os e-mails são novos a cada
 * execução (Date.now()), então não depende de dados anteriores.
 */

const SENHA = 'senha-forte-123'
// Valor incomum de propósito: uma senha curta como "1234" pode aparecer por acaso num uuid do HTML.
const SENHA_APARELHO = 'Zx-Segredo-8431'
const run = Date.now()
const emailDono = `dono.os.${run}@e2e.test`
const emailTecnico = `tecnico.os.${run}@e2e.test`
const nomeCliente = `Cliente OS ${run}`
const TELEFONE_MASCARADO = '(13) 98888-7777'
const TELEFONE_DIGITOS = '13988887777'
const CPF_MASCARADO = '529.982.247-25'

/** Formulários client só valem depois da hidratação; antes disso o clique dispara o submit nativo. */
async function hidratar(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(600)
}

async function entrar(page: Page, email: string, senha: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

async function definirSenhaPeloLink(page: Page, linkUI: string, senha: string) {
  const campoSenha = page.getByLabel('Nova senha')
  await page.goto(linkUI)
  await expect(campoSenha).toBeVisible()
  await page.waitForTimeout(500)
  await expect(campoSenha).toBeVisible()
  await campoSenha.fill(senha)
  await page.getByLabel('Repita a senha').fill(senha)
  await page.getByRole('button', { name: 'Salvar senha' }).click()
  await expect(page).not.toHaveURL(/\/definir-senha/)
}

/** Linhas do histórico da OS (a lista dentro da seção "Histórico"). */
function historico(page: Page) {
  return page.getByRole('region', { name: 'Histórico' }).getByRole('listitem')
}

/** Cabeçalho da OS: o título com o número e o selo da etapa atual, lado a lado. */
function cabecalho(page: Page) {
  return page.getByRole('heading', { level: 1 }).locator('..')
}

/** Abre a OS pelo formulário "Nova OS" (já na página) e espera cair no detalhe. */
async function enviarOS(page: Page) {
  await page.getByRole('button', { name: 'Abrir OS' }).click()
  await expect(page).toHaveURL(/\/servico\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Nº')
}

/** Clica o botão da próxima etapa, pelo rótulo do código, e espera a linha nova no histórico. */
async function avancar(page: Page, de: StatusOS, para: StatusOS) {
  expect(avancosDe(de), `${para} deve ser avanço de ${de}`).toContain(para)
  const antes = await historico(page).count()
  await page.getByRole('button', { name: ROTULO_STATUS[para].rotulo, exact: true }).click()
  await expect(historico(page)).toHaveCount(antes + 1)
  await expect(cabecalho(page)).toContainText(ROTULO_STATUS[para].rotulo)
}

test('serviço ponta a ponta: cliente, OS, orçamento, entrega, link do cliente e técnico', async ({ page, browser }) => {
  const nomeLoja = `Loja OS ${run}`
  let linkDono = ''
  let urlOS = ''
  let urlOSAberta = ''
  let itemMarcado = ''

  await test.step('admin cria a loja e o Dono define a senha', async () => {
    await entrar(page, ADMIN_EMAIL, ADMIN_SENHA)
    await page.goto('/plataforma/lojas/nova')
    await hidratar(page)
    await page.getByLabel('Nome da loja').fill(nomeLoja)
    const seletor = page.locator('#campo-planoId')
    const valorPlano = await seletor.locator('option', { hasText: PLANO_E2E }).first().getAttribute('value')
    expect(valorPlano, `plano "${PLANO_E2E}" na lista`).toBeTruthy()
    await seletor.selectOption(valorPlano!)
    await page.getByLabel('Nome do Dono').fill('Dona OS')
    await page.getByLabel('E-mail do Dono').fill(emailDono)
    await page.getByRole('button', { name: 'Criar loja' }).click()
    linkDono = await page.getByLabel('Link para definir senha').inputValue()
    expect(linkDono).toContain('/definir-senha?token_hash=')

    await definirSenhaPeloLink(page, linkDono, SENHA)
  })

  await test.step('cadastra cliente com telefone e CPF mascarados e acha por dígitos', async () => {
    await page.goto('/clientes')
    await hidratar(page)
    await page.getByLabel(/^Nome/).fill(nomeCliente)
    await page.getByLabel(/^Telefone/).fill(TELEFONE_MASCARADO)
    await page.getByLabel(/^CPF/).fill(CPF_MASCARADO)
    await page.getByRole('button', { name: 'Cadastrar cliente' }).click()
    await expect(page.getByText('Cliente cadastrado.')).toBeVisible()

    // Busca só pelos dígitos do telefone: a normalização casa com o que foi digitado com máscara.
    await page.getByLabel('Buscar cliente').fill(TELEFONE_DIGITOS)
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await expect(page.getByRole('link', { name: nomeCliente })).toBeVisible()
    // E o telefone sai formatado na lista.
    await expect(page.getByRole('row', { name: new RegExp(nomeCliente) })).toContainText(TELEFONE_MASCARADO)
  })

  await test.step('abre a OS: cliente da busca, tablet, defeito, checklist e senha', async () => {
    await page.goto('/servico/nova')
    await hidratar(page)

    await page.getByLabel(/^Buscar cliente/).fill(TELEFONE_DIGITOS)
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await page
      .getByRole('list', { name: 'Clientes encontrados' })
      .getByRole('button', { name: new RegExp(nomeCliente) })
      .click()
    await expect(page.getByRole('button', { name: 'Trocar cliente' })).toBeVisible()

    await page.getByLabel(/^Tipo/).selectOption('tablet')
    await page.getByLabel(/^Marca/).fill('Samsung')
    await page.getByLabel(/^Modelo/).fill('Tab A9')
    await page.getByLabel(/^Defeito relatado/).fill('Não liga depois de molhar')

    const itens = page.getByRole('region', { name: 'Estado do aparelho' }).getByRole('checkbox')
    expect(await itens.count(), 'a loja nova traz itens de checklist').toBeGreaterThan(0)
    await itens.first().check()
    itemMarcado = (await itens.first().evaluate((el) => el.closest('label')?.textContent ?? '')).trim()
    expect(itemMarcado).not.toBe('')

    await page.getByLabel(/^Senha do aparelho/).fill(SENHA_APARELHO)
    await enviarOS(page)
    urlOS = page.url()
  })

  await test.step('a OS aparece na lista de Serviço com cliente e etapa Aberta', async () => {
    await page.goto('/servico')
    const linha = page.getByRole('row', { name: new RegExp(nomeCliente) })
    await expect(linha).toBeVisible()
    await expect(linha).toContainText(ROTULO_STATUS.aberta.rotulo)
    await expect(linha).toContainText('Tablet')
    await linha.getByRole('link', { name: /Nº/ }).click()
    await expect(page).toHaveURL(urlOS)
  })

  await test.step('detalhe: número, selo, histórico de abertura e checklist', async () => {
    await expect(page.getByRole('heading', { level: 1 }).locator('.numeros')).toHaveText(/^Nº \d+$/)
    await expect(cabecalho(page)).toContainText(ROTULO_STATUS.aberta.rotulo)
    await expect(historico(page)).toHaveCount(1)
    await expect(historico(page).first()).toContainText(ROTULO_STATUS.aberta.rotulo)
    await expect(page.getByText('Não liga depois de molhar')).toBeVisible()
    // Só o item marcado vira "Marcado"; os outros ficam "Não marcado".
    await expect(page.getByText('Marcado', { exact: true })).toHaveCount(1)
    await expect(page.getByRole('listitem').filter({ hasText: itemMarcado }).getByText('Marcado', { exact: true })).toBeVisible()
  })

  await test.step('senha do aparelho: fora do HTML, aparece só ao mostrar e some ao ocultar', async () => {
    // Recarrega para o HTML ser o de primeira carga, e espera o botão (a página já terminou de renderizar).
    await page.reload()
    const mostrar = page.getByRole('button', { name: 'Mostrar senha' })
    await expect(mostrar).toBeVisible()

    // Nem no HTML cru que o servidor entrega, nem no DOM depois de renderizar.
    const cru = await (await page.request.get(page.url())).text()
    expect(cru).not.toContain(SENHA_APARELHO)
    expect(await page.content()).not.toContain(SENHA_APARELHO)

    await hidratar(page)
    await mostrar.click()
    await expect(page.getByText(SENHA_APARELHO, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Ocultar senha' }).click()
    await expect(page.getByText(SENHA_APARELHO)).toHaveCount(0)
    expect(await page.content()).not.toContain(SENHA_APARELHO)
    await expect(mostrar).toBeVisible()
  })

  await test.step('Fase B: orçamento, peça com custo, aprovação, pagamento e entrega com lucro', async () => {
    await hidratar(page)
    await avancar(page, 'aberta', 'em_analise')
    // Na OS de cliente, aprovar sai do bloco Orçamento, não do botão de etapa.
    await expect(page.getByRole('button', { name: ROTULO_STATUS.aprovado.rotulo, exact: true })).toHaveCount(0)

    await page.getByLabel('Descrição', { exact: true }).fill('Troca de tela')
    await page.getByLabel('Preço (R$)', { exact: true }).fill('300')
    await page.getByRole('button', { name: 'Lançar item' }).click()
    await expect(page.getByText('Item lançado.')).toBeVisible()

    await page.getByLabel('Peça', { exact: true }).fill('Tela Tab A9')
    await page.getByLabel('Preço cobrado (R$)').fill('350')
    await page.getByRole('button', { name: 'Lançar peça' }).click()
    await expect(page.getByText('Peça lançada.', { exact: false })).toBeVisible()
    await expect(page.getByText('Custo pendente')).toBeVisible()

    await page.getByLabel('Custo por unidade (R$)').fill('280')
    await page.getByRole('button', { name: 'Salvar custo' }).click()
    await expect(page.getByText('Custo salvo.')).toBeVisible()

    const antes = await historico(page).count()
    await page.getByLabel('Quem aprovou').fill('Cliente no balcão')
    await page.getByLabel('Como aprovou').selectOption('balcao')
    await page.getByRole('button', { name: 'Registrar aprovação' }).click()
    await expect(historico(page)).toHaveCount(antes + 1)
    await expect(cabecalho(page)).toContainText(ROTULO_STATUS.aprovado.rotulo)

    await avancar(page, 'aprovado', 'em_servico')
    await avancar(page, 'em_servico', 'pronto')
    // "Entregue" não é botão de etapa: a entrega congela os números.
    await expect(page.getByRole('button', { name: ROTULO_STATUS.entregue.rotulo, exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Entregar aparelho' })).toBeDisabled()
    await expect(page.getByText(/Falta receber R\$\s650,00\./)).toBeVisible()

    await page.reload()
    await hidratar(page)
    await expect(page.getByLabel('Valor (R$)')).toHaveValue('650,00')
    await page.getByRole('button', { name: 'Registrar pagamento' }).click()
    await expect(page.getByText('Pagamento registrado.')).toBeVisible()

    await page.getByRole('button', { name: 'Entregar aparelho' }).click()
    await page.getByRole('button', { name: 'Confirmar entrega' }).click()
    await expect(cabecalho(page)).toContainText(ROTULO_STATUS.entregue.rotulo)

    const sobrou = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Quanto sobrou' }) })
    await expect(sobrou).toContainText(/R\$\s370,00/)

    const caminho: StatusOS[] = ['aberta', 'em_analise', 'aprovado', 'em_servico', 'pronto', 'entregue']
    await expect(historico(page)).toHaveCount(caminho.length)
    for (let i = 0; i < caminho.length; i++) {
      await expect(historico(page).nth(i)).toContainText(ROTULO_STATUS[caminho[i]].rotulo)
    }
  })

  await test.step('OS entregue: laudo trancado, senha sumiu e nenhum botão de etapa', async () => {
    await page.reload()
    await expect(cabecalho(page)).toContainText(ROTULO_STATUS.entregue.rotulo)
    await expect(page.getByText('OS encerrada: o laudo não pode mais ser alterado.')).toBeVisible()

    const laudo = page.getByRole('group', { name: 'Laudo da OS' })
    await expect(laudo).toHaveAttribute('disabled', '')
    await expect(page.getByLabel('Laudo do técnico')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Salvar laudo' })).toBeDisabled()

    await expect(page.getByRole('button', { name: 'Mostrar senha' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Voltar etapa' })).toHaveCount(0)
    for (const s of Object.keys(ROTULO_STATUS) as StatusOS[]) {
      await expect(page.getByRole('button', { name: ROTULO_STATUS[s].rotulo, exact: true })).toHaveCount(0)
    }
    expect(await page.content()).not.toContain(SENHA_APARELHO)
  })

  await test.step('Fase C: loja envia o orçamento e o cliente aprova pelo link, sem login', async () => {
    await page.goto('/servico/nova')
    await hidratar(page)
    await page.getByLabel(/^Buscar cliente/).fill(TELEFONE_DIGITOS)
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await page
      .getByRole('list', { name: 'Clientes encontrados' })
      .getByRole('button', { name: new RegExp(nomeCliente) })
      .click()
    await page.getByLabel(/^Defeito relatado/).fill('Não carrega')
    await enviarOS(page)
    await hidratar(page)
    await avancar(page, 'aberta', 'em_analise')

    await page.getByLabel('Descrição', { exact: true }).fill('Troca do conector')
    await page.getByLabel('Preço (R$)', { exact: true }).fill('180')
    await page.getByRole('button', { name: 'Lançar item' }).click()
    await expect(page.getByText('Item lançado.')).toBeVisible()
    await page.getByRole('button', { name: 'Marcar como enviado' }).click()
    await expect(cabecalho(page)).toContainText(ROTULO_STATUS.orcamento_enviado.rotulo)

    const link = await page.getByLabel('Link de acompanhamento do cliente').inputValue()
    expect(link).toMatch(/\/acompanhar\/[0-9a-f]{48}$/)

    // Outro navegador, sem cookie nenhum: é o celular do cliente.
    const cliente = await browser.newContext()
    const celular = await cliente.newPage()
    await celular.goto(link)
    await expect(celular.getByRole('heading', { level: 1 })).toContainText('Nº')
    expect(await celular.content()).not.toContain(CPF_MASCARADO.replace(/\D/g, ''))
    await hidratar(celular)
    await celular.getByLabel('Seu nome').fill('Cliente pelo celular')
    await celular.getByRole('button', { name: /^Aprovar R\$/ }).click()
    await expect(celular.getByText(/Aprovado em/)).toBeVisible()
    await cliente.close()

    await page.reload()
    await expect(cabecalho(page)).toContainText(ROTULO_STATUS.aprovado.rotulo)
    await expect(historico(page).last()).toContainText('aprovado pelo link por Cliente pelo celular')
  })

  await test.step('segunda OS (interna), em análise: o Dono vê "Voltar etapa"', async () => {
    await page.goto('/servico/nova')
    await hidratar(page)
    await page.getByRole('radio', { name: 'OS interna, sem cliente' }).check()
    await page.getByLabel(/^Defeito relatado/).fill('Bancada: troca de display')
    await enviarOS(page)
    urlOSAberta = page.url()
    expect(urlOSAberta).not.toBe(urlOS)

    await hidratar(page)
    await avancar(page, 'aberta', 'em_analise')
    // Controle do teste do técnico: para o Dono o bloco existe nesta mesma OS.
    await expect(page.getByRole('button', { name: 'Voltar etapa' })).toBeVisible()
    await expect(page.getByLabel('Voltar para uma etapa anterior')).toBeVisible()
  })

  await test.step('técnico abre a mesma OS: vê os avanços, mas não o bloco "Voltar etapa"', async () => {
    await page.goto('/configuracoes/usuarios')
    await hidratar(page)
    await page.getByLabel('Nome', { exact: true }).fill('Técnico OS')
    await page.getByLabel('E-mail', { exact: true }).fill(emailTecnico)
    await page.getByLabel('Perfil').selectOption('tecnico')
    await page.getByRole('button', { name: 'Cadastrar usuário' }).click()
    const linkTecnico = await page.getByLabel('Link para definir senha').inputValue()
    expect(linkTecnico).toContain('/definir-senha?token_hash=')
    await definirSenhaPeloLink(page, linkTecnico, SENHA)

    await page.goto(urlOSAberta)
    await expect(cabecalho(page)).toContainText(ROTULO_STATUS.em_analise.rotulo)
    // A página carregou de verdade e o técnico tem os botões de avanço...
    for (const s of avancosDe('em_analise')) {
      await expect(page.getByRole('button', { name: ROTULO_STATUS[s].rotulo, exact: true })).toBeVisible()
    }
    // ...mas nada de voltar etapa: nem o botão, nem o seletor, nem o aviso "só o Dono".
    await expect(page.getByRole('button', { name: 'Voltar etapa' })).toHaveCount(0)
    await expect(page.getByLabel('Voltar para uma etapa anterior')).toHaveCount(0)
    await expect(page.getByText('Só o Dono pode voltar')).toHaveCount(0)
  })
})
