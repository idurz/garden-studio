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

The first launch starts with an editable example. Select **New project** to replace it with an empty garden, or **Set garden size** above the plan (also available in **Project settings**) to set the current garden's rectangular dimensions. Width runs left to right and depth runs top to bottom. Enter centimetres: 100 cm = 1 m, and each 10 cm adds one grid square. For example, a 19 × 31 m plot is **1900 × 3100 cm**, or **190 × 310 squares**. Dimensions must be multiples of 10 cm, from 10 cm to 5,000 cm (50 m) per side; the settings show the resulting grid size. After selecting **Create new project** or changing the size, select **Replace garden** in the confirmation shown in the dialog. This clears the layout, plants, utilities, and reference image. Export first if you want to keep the current design.

Use **Clear workspace** to select which items to remove while keeping the name and dimensions. Clearing ground cover also removes all plants because they require soil; buildings are separate and remain unless selected. Other layers and the reference image remain unless selected. Confirm the selection before clearing; this cannot be undone.

Upload a PNG, JPEG, or WebP image up to 10 MB under **Design reference**. The image is stretched to fill the whole rectangular garden; make sure its edges match the dimensions you entered. It is a tracing reference, not automatic recognition of surfaces or plants. Adjust its opacity or remove it as needed. The image is included in the saved project and backups.

Select **Ground cover**, choose soil / sand, grass, or paving, and draw by clicking and dragging. Choose a **Brush size** of 10 × 10, 30 × 30, or 50 × 50 cm to cover larger areas; the brush also applies to **Erase**. Its outline is centered on the current square and clipped at garden edges. Select **Plants & trees** and click an unoccupied soil / sand square to add a plant; it starts at 30 × 30 cm when space permits, otherwise 10 × 10 cm. Select a plant to edit its name, type, footprint, position, purchase date, supplier, pruning schedule, and notes, then click **Save plant details**. Width and depth are in 10 cm increments; positions are grid columns and rows counted from the top left. Plants must fit entirely on soil / sand without overlapping another plant or a building wall, door, or window. Move or remove a plant before changing the material underneath it.

Select **Buildings**, then **Add building**. Draw the first wall anywhere on the grid. You can draw additional wall segments anywhere and connect them to make a custom shape; unfinished or separate segments remain part of the same building. Walls can be drawn over ground cover but not over plants or another building. Choose **Door** or **Window** in Materials and draw over the selected building's walls; each square is 10 cm wide. Choose **Wall** to turn an opening back into a wall. **Erase** removes squares from the selected building. Use the building list to switch objects, rename or delete one, or use **Select** and click its wall. Hide the building layer with its eye button, or clear all buildings via **Clear workspace**. Buildings are diagrammatic, not construction plans.

Choose **Water pipes** or **Electricity** to draw or erase utility routes. Use the eye buttons to show or hide layers; visibility does not delete their contents. Routes are diagrammatic grid annotations, not construction plans. Use zoom or **Fit to view** to navigate the plan.

Changes to the plan are saved automatically; check the status in the header. If saving fails, keep the tab open, resolve the storage problem, and use **Retry save**. Plant form edits must be applied with **Save plant details**. **Export** downloads a JSON backup including the reference image; **Project settings → Import backup** replaces the current project with a previously exported file. Saved projects and imported backups are limited to 25 MB each; exceptionally detailed projects may require a smaller reference image. Only one project is stored at a time. Back up your work before replacing it. The app does not synchronize simultaneous edits in multiple browser tabs; use one tab at a time.

## Development

The app uses Node's built-in HTTP server and browser APIs; there are no runtime dependencies. Run the tests with:

```sh
npm test
```
