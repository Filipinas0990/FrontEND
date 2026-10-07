import { createFileRoute } from "@tanstack/react-router";

/**
 * Política de Privacidade — página PÚBLICA (sem login).
 *
 * Existe porque o app do Meta só sai do modo de desenvolvimento ("Ao vivo")
 * com uma URL de política de privacidade, e o Meta também pede instruções de
 * exclusão de dados (a seção #exclusao-de-dados serve para isso). Não usa o
 * AppShell: é lá que mora a guarda de sessão.
 */
export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
  head: () => ({ meta: [{ title: "Política de Privacidade — GrupoSymbol" }] }),
});

const ATUALIZADA_EM = "7 de outubro de 2026";

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <article className="mx-auto max-w-3xl bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 sm:p-10 text-zinc-700 leading-relaxed">
        <h1 className="text-2xl font-bold text-zinc-900">Política de Privacidade</h1>
        <p className="text-sm text-zinc-500 mt-1">Última atualização: {ATUALIZADA_EM}</p>

        <Secao titulo="1. Quem somos">
          Esta política se aplica ao sistema de gestão de tráfego e campanhas da <b>GrupoSymbol</b>, usado pela
          nossa equipe de gestores para criar e acompanhar anúncios de farmácias clientes nas plataformas da Meta
          (Facebook e Instagram) e para enviar ofertas por WhatsApp.
        </Secao>

        <Secao titulo="2. Quais dados coletamos">
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Dados de acesso dos gestores:</b> nome, e-mail e senha (guardada de forma criptografada).</li>
            <li>
              <b>Dados da conta do Facebook do gestor</b>, quando ele escolhe conectá-la: identificador e nome do
              perfil e um token de acesso, que permite ao sistema criar e consultar campanhas em nome dele.
            </li>
            <li>
              <b>Dados de publicidade</b> das contas de anúncio, páginas e contas do Instagram às quais o gestor tem
              acesso: nomes, campanhas, conjuntos, anúncios, públicos e métricas de desempenho.
            </li>
            <li><b>Dados das farmácias clientes</b> necessários para os anúncios: nome, endereço, produtos e preços.</li>
          </ul>
        </Secao>

        <Secao titulo="3. Para que usamos os dados">
          Usamos os dados exclusivamente para operar o serviço: criar, editar e publicar campanhas de anúncios,
          exibir relatórios de desempenho aos gestores e às farmácias clientes e enviar ofertas autorizadas. Não
          vendemos dados, não os usamos para publicidade própria e não os compartilhamos com terceiros além das
          próprias plataformas da Meta, necessárias para publicar os anúncios.
        </Secao>

        <Secao titulo="4. Permissões da Meta">
          Ao conectar o Facebook, o gestor autoriza o sistema a usar as permissões ads_management, ads_read,
          business_management, pages_show_list, pages_read_engagement, pages_manage_ads e instagram_basic, apenas
          para gerenciar os anúncios das contas a que ele já tem acesso. O gestor pode revogar a autorização a
          qualquer momento nas configurações do Facebook (Configurações → Integrações comerciais) ou no próprio
          sistema (Configurações → Facebook → Desconectar).
        </Secao>

        <Secao titulo="5. Armazenamento e segurança">
          Os dados ficam em servidores protegidos. Senhas e tokens de acesso são guardados criptografados e nunca
          são exibidos no sistema. O acesso é restrito à equipe autorizada, mediante login.
        </Secao>

        <Secao titulo="6. Por quanto tempo guardamos">
          Mantemos os dados enquanto o gestor ou a farmácia cliente usar o serviço. O token de acesso do Facebook
          expira automaticamente (em geral em 60 dias) e é apagado quando o gestor se desconecta.
        </Secao>

        <Secao titulo="7. Exclusão de dados" id="exclusao-de-dados">
          Para pedir a exclusão dos seus dados:
          <ol className="list-decimal pl-5 space-y-1 mt-2">
            <li>
              <b>Dados do Facebook:</b> no sistema, acesse Configurações → Facebook (Meta Ads) → Desconectar. O token
              e os dados do perfil são apagados na hora. Você também pode remover o app em Facebook → Configurações
              → Integrações comerciais.
            </li>
            <li>
              <b>Demais dados:</b> peça a exclusão ao administrador da agência pelos canais de atendimento da
              GrupoSymbol. Atendemos em até 30 dias, conforme a Lei Geral de Proteção de Dados (LGPD).
            </li>
          </ol>
        </Secao>

        <Secao titulo="8. Seus direitos (LGPD)">
          Você pode, a qualquer momento, confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir sua
          exclusão ou revogar consentimentos, nos termos da Lei nº 13.709/2018.
        </Secao>

        <Secao titulo="9. Alterações desta política">
          Esta política pode ser atualizada. A data da última atualização fica sempre no topo desta página.
        </Secao>
      </article>
    </div>
  );
}

function Secao({ titulo, id, children }: { titulo: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-7 scroll-mt-6">
      <h2 className="text-lg font-semibold text-zinc-900 mb-2">{titulo}</h2>
      <div className="text-sm">{children}</div>
    </section>
  );
}
