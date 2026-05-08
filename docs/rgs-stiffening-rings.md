# RGS stiffening rings and diaphragms

This note is a local calculation reference for the RGS calculator.

## Current rule

- Automatic layout uses shell-course joints as the practical minimum.
- Default shell course length: 1490 mm.
- Default minimum clearance from heads: 500 mm.
- Joints closer than the clearance to a head are skipped.
- If the external-pressure stability check requires more rings, calculation may add rings beyond the fabrication minimum.

## Current formulas in the calculator

Effective shell thickness:

```text
t_eff = t_nom - c_corrosion - c_minus
```

External pressure required for underground tanks:

```text
p_v = gamma_f * gamma_soil * H
K_a = tan(45 deg - phi / 2)^2
p_h = p_v * K_a * (1 + e / 3)
p_avg = 0.75 * p_v + 0.5 * p_h
p_req = max(0, p_avg / 1000 + p_vacuum - p_hydro - p_internal)
```

Shell capacity between rings:

```text
lambda = L_free^2 / (D * t_eff)
p_elastic = 2.08e-5 * E * D / (2.4 * L_free) * (100 * t_eff / D)^2.5
p_strength = 2 * sigma * t_eff / (D + t_eff) * (2 + lambda) / (1 + lambda)
p_allow = p_strength / sqrt(1 + (p_strength / p_elastic)^2)
```

Ring count condition:

```text
p_allow >= p_req
```

## Standards library

The machine-readable standards index is stored at:

```text
backend/data/standards/rgs_stiffening_rings.json
```

It intentionally stores metadata and links, not full copyrighted standard texts.

## Next engineering step

Add a section-property check for the ring itself:

- selected profile type and dimensions;
- area, centroid, moment of inertia;
- required stiffening-ring inertia according to the selected calculation basis;
- pass/fail comparison and profile recommendation.
