# vite-plugin-salad
This package does transforms on `.s.html` files to convert them to JSX (or TSX potentially!) for use in SolidJS projects.

## Usage
Install `vite-plugin-solid` using the steps listed [here](https://github.com/solidjs/vite-plugin-solid#installation).

Then install `vite-plugin-salad` as a dev dependency.
```bash
# with npm
$ npm install -D vite-plugin-salad

# with pnpm
$ pnpm add -D vite-plugin-salad

# with yarn
$ yarn add -D vite-plugin-salad
```
Add it as a plugin to `vite.config.js`
```js
// vite.config.js
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import saladPlugin from 'vite-plugin-salad';

export default defineConfig({
  plugins: [solidPlugin(), saladPlugin()],
});
```

You can now import `.s.html` components in your Solid app.