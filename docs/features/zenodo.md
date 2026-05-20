# Zenodo Integration

Publish your presentation to [Zenodo](https://zenodo.org) to get a **citeable DOI** (Digital Object Identifier). This makes your slides a proper research output that can be referenced in papers, theses, and CVs.

## What gets published

When you publish to Zenodo, Parallax uploads:

- **presentation.html** — the self-contained reveal.js slides (viewable in any browser)
- **presentation.json** — the full Parallax project file (can be re-imported later)
- **assets/** — all images, videos, and other media used in the presentation

Zenodo stores these files permanently and assigns a DOI that resolves to the record page.

## Setting up your Zenodo token

1. Create an account at [zenodo.org](https://zenodo.org) (or [sandbox.zenodo.org](https://sandbox.zenodo.org) for testing).
2. Go to **Settings > Applications > Personal access tokens**.
3. Click **New token** and give it a name (e.g. "Parallax").
4. Check the **deposit:write** scope — this is the only permission needed.
5. Click **Create** and copy the token.

In Parallax:

1. Open a presentation and click **Sync > Zenodo**.
2. Paste the token into the **API Token** field.
3. If you want to test first, check **Use Sandbox**.
4. Click **Save Settings**.

The connection status banner at the top of the modal will turn green once the token is saved.

::: tip
The sandbox and production instances are completely separate. You need a different account and token for each. Start with sandbox to verify everything works, then switch to production for the real DOI.
:::

## Filling in metadata

Good metadata makes your presentation discoverable and citeable. Fill in the fields before publishing:

### Creators

Add every author. Each creator has:

- **Name** (required) — use "Last, First" format for proper citation indexing (e.g. "Birky, Jessica").
- **Affiliation** — your institution (e.g. "University of Washington").
- **ORCID** — your ORCID iD if you have one (e.g. "0000-0001-2345-6789"). This links the record to your ORCID profile.

Click **+ Add creator** for multi-author presentations. Order matters — list authors in the same order as on your title slide.

### Description

A brief summary of the presentation content. This appears on the Zenodo record page and in search results. A few sentences is enough — think of it like an abstract.

### Keywords

Comma-separated terms that help others find your work (e.g. "stellar evolution, spectroscopy, M dwarfs"). Choose terms that someone searching for your topic would use.

### License

Controls how others can reuse your slides. Options:

| License | What it allows |
|---------|---------------|
| **CC BY 4.0** (default) | Anyone can reuse with attribution |
| **CC BY-SA 4.0** | Reuse with attribution, derivatives must use same license |
| **CC BY-NC 4.0** | Reuse with attribution, non-commercial only |
| **CC0** | Public domain, no restrictions |
| **MIT** | Permissive software-style license |
| **Apache 2.0** | Permissive with patent grant |

::: tip
**CC BY 4.0** is the most common choice for academic presentations. It lets others reuse your figures with credit, which is standard practice in research.
:::

## Publishing

1. Fill in all metadata fields.
2. Click **Publish to Zenodo**.
3. Wait for the upload to complete — this may take a moment if your presentation has large media files.
4. On success, you'll see your DOI and a link to the Zenodo record.

::: warning
Publishing is **permanent**. Once a DOI is minted, the record cannot be deleted (this is by design — DOIs are meant to be persistent identifiers). You can publish a new version, but the original remains. Use the sandbox to test first.
:::

## Citing your presentation

After publishing, your DOI will look like:

```
10.5281/zenodo.1234567
```

Use it in citations like:

> Birky, J. (2026). *Stellar Variability Analysis*. Zenodo. https://doi.org/10.5281/zenodo.1234567

Or in BibTeX:

```bibtex
@misc{birky2026stellar,
  author    = {Birky, Jessica},
  title     = {Stellar Variability Analysis},
  year      = {2026},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.1234567},
  url       = {https://doi.org/10.5281/zenodo.1234567}
}
```

The DOI link on the Zenodo record page also has a "Cite as" section with pre-formatted citations in multiple styles.

## Publishing a new version

If you update your presentation and want to publish the changes:

1. Open the same presentation and click **Sync > Zenodo**.
2. Update the metadata if needed.
3. Click **Publish to Zenodo** again.

This creates a **new deposition** with a new DOI. Zenodo does not currently support versioned depositions through the Parallax integration — each publish is an independent record. You can reference the latest version in your citations.

## Troubleshooting

**"No API token saved"** — Make sure you clicked **Save Settings** after pasting the token. Check that the connection status banner turns green.

**"Zenodo API 400/403"** — Your token may have expired or lack the `deposit:write` scope. Generate a new one from Zenodo settings.

**"Publish failed"** — Check that you have at least one creator with a name filled in. The name field uses "Last, First" format but any non-empty string is accepted.

**Sandbox DOIs don't resolve** — This is expected. Sandbox DOIs are test-only and don't register with the global DOI system. Switch off the sandbox checkbox to publish for real.
