# Garden Studio

A private, local garden planner. Trace an existing plan, lay out surfaces on a 10 × 10 cm grid, record plant details, and map water pipes and electrical cables on separate layers. No account, external service, or internet connection is needed while using the app.

## Get started with Docker

Install Docker with Docker Compose, then download or clone this project and run in its directory:

```sh
docker compose up --build -d
```

Open [http://localhost:3000](http://localhost:3000). The default Compose configuration binds only to this computer. Stop the app with `docker compose down`; the named `garden-data` volume is retained across restarts and rebuilds. Do not remove the volume unless you intend to delete the saved garden. Export a backup before moving or removing it.

To update after downloading changes, run `docker compose up --build -d` again.

## Published container image

Like Mail Automation, a push to `main` runs a GitHub Actions workflow that builds and publishes `ghcr.io/idurz/garden-studio:latest` and a tag for the full commit SHA. The image is available after the workflow has successfully run; check the package's GitHub visibility settings if an unauthenticated pull is denied.

To run the published image without cloning or building the project:

```sh
docker pull ghcr.io/idurz/garden-studio:latest
docker run -d --name garden-studio --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v garden-studio-data:/data \
  ghcr.io/idurz/garden-studio:latest
```

Open [http://localhost:3000](http://localhost:3000). The named volume retains your garden when the container is removed. To update, pull the image again, remove the old container with `docker rm -f garden-studio`, and run the same `docker run` command. The source-build Compose setup uses a separate volume; export and import a backup to move a garden between the two setups. The published image is built for the GitHub Actions runner's architecture (currently `linux/amd64`).

Alternatively, with Node.js 20 or newer:

```sh
npm start
```

The Node server listens on port 3000 by default and stores the project in `./data/garden.json`. Set `PORT` and `DATA_DIR` to change those values. Without Compose, the server listens on all network interfaces; protect it with a firewall and do not expose it to untrusted networks. It has no authentication and is intended for local use only.

## Design a garden

The first launch starts with an editable example. Open **Project settings** to name your garden and set its width and depth in centimetres. Dimensions must be multiples of 10 cm, from 10 cm to 1,500 cm per side. Changing the dimensions clears the layout, plants, utilities, and reference image after confirmation. Export first if you want to keep the current design.

Upload a PNG, JPEG, or WebP image up to 10 MB under **Design reference**. The image is stretched to fill the whole rectangular garden; make sure its edges match the dimensions you entered. It is a tracing reference, not automatic recognition of surfaces or plants. Adjust its opacity or remove it as needed. The image is included in the saved project and backups.

Select **Ground cover**, choose soil / sand, grass, or paving, and draw by clicking and dragging. Use **Erase** to clear cells. Select **Plants & trees** and click an unoccupied soil / sand square to add a plant; it starts at 30 × 30 cm when space permits, otherwise 10 × 10 cm. Select a plant to edit its name, type, footprint, position, purchase date, supplier, pruning schedule, and notes, then click **Save plant details**. Width and depth are in 10 cm increments; positions are grid columns and rows counted from the top left. Plants must fit entirely on soil / sand without overlapping another plant. Move or remove a plant before changing the material underneath it.

Choose **Water pipes** or **Electricity** to draw or erase utility routes. Use the eye buttons to show or hide layers; visibility does not delete their contents. Routes are diagrammatic grid annotations, not construction plans. Use zoom or **Fit to view** to navigate the plan.

Changes to the plan are saved automatically; check the status in the header. If saving fails, keep the tab open, resolve the storage problem, and use **Retry save**. Plant form edits must be applied with **Save plant details**. **Export** downloads a JSON backup including the reference image; **Project settings → Import backup** replaces the current project with a previously exported file. Only one project is stored at a time. Back up your work before replacing it. The app does not synchronize simultaneous edits in multiple browser tabs; use one tab at a time.

## Development

The app uses Node's built-in HTTP server and browser APIs; there are no runtime dependencies. Run the tests with:

```sh
npm test
```
