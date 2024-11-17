# HOW TO RUN:
### from shm

1. Open Terminal, which you will use to do the following:
2. `git clone <this directory URL>` to clone this directory, then use `cd FofoWriter/fofo-writer` to open the directory
3. make sure you have Node and npm installed. you can check this by running `npm -v` and `node -v` (which should each print which version of npm and node you have installed)
If it instead says `command not found` then use the instructions here to [install node and npm](https://nodejs.org/en/download/package-manager) 
4. make sure you're in the fofo-writer directory (type `ls` to list the files in your current directory; you should see the `node_modules` folder and `package.json` file listed, among others)
5. enter `npm install` to install all the required modules for this project
6. enter `npm run dev` to run the server. You should see something like: 
```
VITE v5.4.11  ready in 594 ms

  ➜  Local:   http://localhost:5173/
```
7. Open your browser to [http://localhost:5173/]( http://localhost:5173/) to see our cool application running in your browser

# HOW TO EDIT THE CODE

*index.html* is the entrypoint for our application. That means Vite starts building our website by looking in that file. *index.html*  which includes this line:
```html
<script type="module" src="/src/main.tsx"></script>
```

Which tells it to look for `src/main.tsx` and display whatever is in there.

*main.tsx* (in the src/ folder) says to display our React "App"

How does Vite + React know what our "App" is? This is described in **src/App.tsx**

Right now our App simply returns a single React component:
``return <ScriptCoWriter />``

This "ScriptCoWriter" component is defined by the code in ``script-cowriter.tsx``

***All that to say, you probably want to edit ``script-cowriter.tsx`` (in the src directory)*** which contains the script-cowriter component that Yanru + Claude made...

OR you might want to make new components (by making new .tsx files in the /src directory, e.g. *newcomponent.tsx*) then adding to the App.tsx file to include your new component in the application. 

## How to edit the ~style~

You'll notice that a lot of the html in our ``script-cowriter.tsx`` file looks like this:

```html
<div className="w-32 h-32 bg-orange-400 rounded-full relative">
```

That's because we're using tailwind-css (instead of pure css) so to style ``<div> some text </div>`` to make the text smaller, you just give it one of tailwind's built in class names (by adding it to the ``className`` list)

```html
<div className="text-sm "> some text </div>
```

^ this will make the font size ~14px


```html
<div className="w-32 h-32 bg-orange-400 rounded-full relative">
```
this says, set everything in this section to have a [width and height](https://tailwindcss.com/docs/width) of 32px, [orange background](https://tailwindcss.com/docs/background-color), and use [relative](https://v1.tailwindcss.com/docs/position) positioning. 

How to know what all the tailwind classes are? You can look throught he documentation as linked above. you could probably also just tell ChatGPT what you want (eg I want this section to be pink with rounded corners or whatever, tell me what tailwind classes to use)

We can change the overall ``theme'' (default look) of our app in tailwind.config.js [see instructions here](https://tailwindcss.com/docs/theme).


# React + TypeScript + Vite Setup README stuff below

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
