# Canvas Refactor App

Este projeto é uma aplicação React que implementa um sistema de canvas otimizado, com o objetivo de evitar oscilações no layout e melhorar a experiência do usuário.

## Estrutura do Projeto

A estrutura do projeto é a seguinte:

```
canvas-refactor-app
├── src
│   ├── components
│   │   ├── Canvas
│   │   │   ├── Canvas.tsx          # Componente principal do canvas
│   │   │   ├── Canvas.test.tsx      # Testes unitários para o componente Canvas
│   │   │   ├── Canvas.stories.tsx   # Histórias do componente Canvas
│   │   │   └── index.ts             # Exportação do componente Canvas
│   │   ├── StableCanvas
│   │   │   ├── StableCanvas.tsx     # Componente otimizado para estabilidade
│   │   │   ├── StableCanvas.test.tsx # Testes unitários para o StableCanvas
│   │   │   └── index.ts             # Exportação do componente StableCanvas
│   │   └── index.ts                 # Centraliza as exportações de todos os componentes
│   ├── hooks
│   │   └── useCanvas.ts             # Hook personalizado para gerenciamento do canvas
│   ├── utils
│   │   └── canvasUtils.ts           # Funções utilitárias relacionadas ao canvas
│   ├── styles
│   │   └── canvas.css               # Estilos CSS aplicados aos componentes do canvas
│   ├── App.tsx                      # Ponto de entrada da aplicação
│   └── index.tsx                    # Ponto de entrada do React
├── public
│   └── index.html                   # HTML base da aplicação
├── package.json                     # Configuração do npm
├── tsconfig.json                   # Configuração do TypeScript
├── .eslintrc.json                  # Configurações do ESLint
├── .prettierrc                     # Configurações do Prettier
└── README.md                       # Documentação do projeto
```

## Instalação

Para instalar as dependências do projeto, execute o seguinte comando:

```
npm install
```

## Uso

Para iniciar a aplicação em modo de desenvolvimento, utilize o comando:

```
npm start
```

A aplicação estará disponível em `http://localhost:3000`.

## Testes

Para executar os testes unitários, utilize o comando:

```
npm test
```

## Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

## Licença

Este projeto está licenciado sob a MIT License.