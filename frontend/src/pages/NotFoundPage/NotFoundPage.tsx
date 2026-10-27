import { RoutePage } from '../../components/layout/RoutePage/RoutePage'

export function NotFoundPage() {
  return (
    <RoutePage
      eyebrow="Erro 404"
      title="Esta página não foi encontrada."
      description="O endereço informado não existe ou pode ter sido alterado. Use a navegação para continuar acessando o BarberShop."
    />
  )
}
