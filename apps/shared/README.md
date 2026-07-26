# apps/shared

The shared MiniApp runtime that used to live here is now published as
[`@r3e-network/neo-miniapp-shared`](https://github.com/r3e-network/neo-miniapp-sdk),
and `@shared/*` resolves to it out of `node_modules`.

This directory is deliberately not empty. Several tests reach a sibling app by
traversing through it (`apps/shared/../<slug>/...`), which the OS resolves only
when every segment on the way exists — removing the directory made those reads
fail with ENOENT even though the target file was present.

Nothing else belongs here. Add shared code to the SDK repository instead.
