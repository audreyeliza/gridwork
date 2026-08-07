# Gridwork

A filet crochet pattern maker. Design mesh grids, save patterns, browse a public gallery, and share maker profiles.

**Live:** [https://gridwork-seven.vercel.app/](https://gridwork-seven.vercel.app/)  
**Contact:** [gridworkapp@gmail.com](mailto:gridworkapp@gmail.com)

## Design

The UI is redesigned around the **IBM 129** card data recorder — punch-card machine aesthetics with manila cards, console knobs and lamps, and chassis blues/grays on an off-white desk. Patterns live as punched cards in the Hopper; editing happens on the Program console.

Colors, fonts, operator-card headers, and naming rules: **[docs/DESIGN.md](docs/DESIGN.md)**.

## Stack

Next.js, React, Tailwind CSS, Supabase (auth + data)

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `.env.local` with your Supabase keys (see existing env vars in the project).
