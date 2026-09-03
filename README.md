# Diário do Bebê

Aplicação web (PWA) para acompanhar a rotina e a saúde de um recém-nascido:
mamadas, trocas de fralda e crescimento, com um dashboard para visualizar padrões.

Funciona no navegador do celular e pode ser instalada na tela inicial do Android
("Adicionar à tela inicial"), comportando-se como um app nativo, inclusive offline.

## Funcionalidades

**Mamadas**
- Escolha o peito a oferecer (esquerdo ou direito) e o cronômetro inicia na hora
- Sugestão automática do próximo peito, alternando em relação à última mamada
- O cronômetro sobrevive a fechar/reabrir o app (o horário de início fica salvo)
- Histórico com lado, horário e duração de cada mamada

**Fraldas**
- Registro em um toque: xixi, cocô ou ambos
- Mostra há quanto tempo foi a última troca
- Histórico com data e horário

**Crescimento**
- Registro de peso (kg) e altura (cm) por data
- Gráficos de evolução de peso e altura

**Dashboard**
- Resumo do dia: última mamada, última fralda, totais do dia e última medição
- Gráfico de mamadas por dia (últimos 7 dias)
- Gráfico de fraldas por dia, separado por tipo (últimos 7 dias)
- Alertas simples: mais de 4h sem mamar ou mais de 6h sem troca de fralda

## Dados

Tudo é salvo localmente no dispositivo (IndexedDB) — nada é enviado para servidores.
Em "Bebê" há a opção de exportar todos os registros em JSON como backup.

## Desenvolvimento

```bash
npm install
npm run dev      # servidor local em http://localhost:5173
npm run build    # build de produção em dist/
npm run preview  # serve o build de produção
```

Stack: React + TypeScript + Vite, Dexie (IndexedDB), Recharts, vite-plugin-pwa.
