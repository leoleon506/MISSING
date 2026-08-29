# Experiment 5A — Pre-Live Arithmetic Erratum

## Status

This erratum was recorded before any live 5A holdout case was executed or observed.

The original preregistration remains unchanged at commit:

`32cef9733580c3163d0952f483c027281bc5457e`

## Arithmetic correction

The preregistration text says that the frozen 18-case workload spans **10 semantic families**.

The 18 individually preregistered case definitions actually enumerate **11 distinct family labels**:

1. geography
2. games
3. language
4. software
5. science
6. literature
7. security
8. media
9. space
10. publication
11. network

Therefore the derived total family count is **11**, not 10.

## What does NOT change

This arithmetic correction does not modify:

- any of the 18 case IDs;
- any family label assigned to a case;
- any task intent;
- any build input;
- any replay input;
- any required output;
- any semantic validator;
- the frozen 4W engine SHA;
- the provider/network budget;
- any safety rule;
- the primary manufacture threshold of `>= 6 / 18`;
- the primary family threshold of `>= 6 successful families`;
- the distinct-provider threshold of `>= 6`;
- the replay threshold of `>= 0.95`;
- any cost or latency threshold;
- any decision string.

The original preregistration file is intentionally not edited. Runtime integrity and reporting must derive and report the true family count of 11 from the already-frozen case labels.

## Scientific interpretation

This is a pre-live arithmetic erratum, not workload tuning. No 5A result existed when it was recorded, so it provides no information that could be used to select cases, alter validators, or lower a GO threshold.
