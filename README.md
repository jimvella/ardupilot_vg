Website https://jimvella.github.io/ardupilot_vg/

## Developing

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building and Deployment

```bash
npm run build
```

Deployment is via Github pages. svelte.config.js has been configured to output the built static site to /docs for Github pages. Publishing is a matter of committing the changes to /docs and pushing to Github.
