# BarberShop

Aplicação web para gestão e agendamento de atendimentos em barbearias.

## Back-end

Requisitos: Node.js 24, npm e PostgreSQL 15 ou superior. O arquivo `.nvmrc` da
raiz seleciona a versão utilizada no projeto.

```bash
nvm use
cd Backend
npm install
cp .env.example .env
```

Edite o `.env` com a conexão do seu PostgreSQL e uma chave JWT própria. Com o
banco já em execução, inicie a API:

```bash
npm run dev
```

O comando padrão não inicia nem encerra o PostgreSQL, pois a instalação e o
caminho dos dados variam entre sistemas operacionais e máquinas.

### Atalho local opcional

Para controlar uma instalação local do PostgreSQL junto com a API:

```bash
cp scripts/dev.local.example.sh scripts/dev.local.sh
```

Configure `BARBERSHOP_PG_DATA` com o diretório de dados do PostgreSQL. Se
`pg_ctl` não estiver disponível no `PATH`, configure também
`BARBERSHOP_PG_CTL`. É possível alterar a porta e os demais caminhos pelas
variáveis documentadas no próprio arquivo. `scripts/dev.local.sh` é ignorado
pelo Git. Depois, execute:

```bash
npm run dev:local
```

Nesse modo, o PostgreSQL é encerrado com o backend somente quando tiver sido
iniciado pelo próprio script.

## Front-end

```bash
nvm use
cd frontend
npm install
cp .env.example .env
npm run dev
```
