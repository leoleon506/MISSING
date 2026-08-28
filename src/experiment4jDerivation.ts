import {deriveExperiment4hSource} from "./experiment4hDerivation.js";

function r(s:string,a:string,b:string){
  if(!s.includes(a))throw new Error(`4j_anchor_missing:${a.slice(0,140)}`);
  return s.replace(a,b);
}

export function deriveExperiment4jSource(source:string){
  let x=deriveExperiment4hSource(source);
  x=r(x,
    'import {compile4h as compile4ar,project4h as project4ar,scope4h as scope4ar,validate4h as validate4ar,validateProjected4h as validateProjected4ar} from "./experiment4hContract.js";',
    'import {compile4j as compile4ar,project4j as project4ar,scope4j as scope4ar,validate4j as validate4ar,validateProjected4j as validateProjected4ar} from "./experiment4jContract.js";'
  );
  x=r(x,
    'import {synthesize4h as synthesize4ar} from "./experiment4hPlanner.js";',
    'import {synthesize4j as synthesize4ar} from "./experiment4jPlanner.js";'
  );
  x=r(x,'const OUT="results/experiment-4h",MAX_BYTES=FOUR_A_BUDGET.max_bytes;','const OUT="results/experiment-4j",MAX_BYTES=FOUR_A_BUDGET.max_bytes;');

  x=r(x,'documentationOriginFallbacks4h=0;',`documentationOriginFallbacks4h=0,
placeholderBearingOperations4j=0,placeholderPreservationChecks4j=0,placeholderPreservationFailures4j=0,authPairsPrunedSurgically4j=0,nonAuthRequestTextMutations4j=0,
identifierRoleCandidates4j=0,identifierRoleAcceptedNamedParameter4j=0,identifierRoleAcceptedExactPlaceholder4j=0,identifierRoleAcceptedGenericPlaceholder4j=0,identifierRoleAcceptedUniqueBuildValue4j=0,identifierRoleAcceptedQueryKey4j=0,identifierRoleAcceptedPathSegment4j=0,
identifierRoleRejectedEntityMismatch4j=0,identifierRoleRejectedSecondarySupport4j=0,identifierRoleRejectedAmbiguousOccurrence4j=0,identifierRoleRejectedSubstring4j=0,identifierRoleRejectedAuthLike4j=0,
renderCompileRejected4j=0,renderUrlParseRejected4j=0,entityIncompatibleStructuralProbeAttempts4j=0;`);

  x=r(x,'documentationOriginFallbacks4h+=sm.documentationOriginFallbacks||0;',`documentationOriginFallbacks4h+=sm.documentationOriginFallbacks||0;
placeholderBearingOperations4j+=sm.placeholderBearingOperations||0;placeholderPreservationChecks4j+=sm.placeholderPreservationChecks||0;placeholderPreservationFailures4j+=sm.placeholderPreservationFailures||0;authPairsPrunedSurgically4j+=sm.authPairsPrunedSurgically||0;nonAuthRequestTextMutations4j+=sm.nonAuthRequestTextMutations||0;
identifierRoleCandidates4j+=sm.identifierRoleCandidates||0;identifierRoleAcceptedNamedParameter4j+=sm.identifierRoleAcceptedNamedParameter||0;identifierRoleAcceptedExactPlaceholder4j+=sm.identifierRoleAcceptedExactPlaceholder||0;identifierRoleAcceptedGenericPlaceholder4j+=sm.identifierRoleAcceptedGenericPlaceholder||0;identifierRoleAcceptedUniqueBuildValue4j+=sm.identifierRoleAcceptedUniqueBuildValue||0;identifierRoleAcceptedQueryKey4j+=sm.identifierRoleAcceptedQueryKey||0;identifierRoleAcceptedPathSegment4j+=sm.identifierRoleAcceptedPathSegment||0;
identifierRoleRejectedEntityMismatch4j+=sm.identifierRoleRejectedEntityMismatch||0;identifierRoleRejectedSecondarySupport4j+=sm.identifierRoleRejectedSecondarySupport||0;identifierRoleRejectedAmbiguousOccurrence4j+=sm.identifierRoleRejectedAmbiguousOccurrence||0;identifierRoleRejectedSubstring4j+=sm.identifierRoleRejectedSubstring||0;identifierRoleRejectedAuthLike4j+=sm.identifierRoleRejectedAuthLike||0;
renderCompileRejected4j+=sm.renderCompileRejected||0;renderUrlParseRejected4j+=sm.renderUrlParseRejected||0;entityIncompatibleStructuralProbeAttempts4j+=sm.entityIncompatibleStructuralProbeAttempts||0;`);

  x=r(x,'documentationOriginFallbacks:documentationOriginFallbacks4h,schemaProbeCalls',`documentationOriginFallbacks:documentationOriginFallbacks4h,
placeholderBearingOperations:placeholderBearingOperations4j,placeholderPreservationChecks:placeholderPreservationChecks4j,placeholderPreservationFailures:placeholderPreservationFailures4j,authPairsPrunedSurgically:authPairsPrunedSurgically4j,nonAuthRequestTextMutations:nonAuthRequestTextMutations4j,
identifierRoleCandidates:identifierRoleCandidates4j,identifierRoleAcceptedNamedParameter:identifierRoleAcceptedNamedParameter4j,identifierRoleAcceptedExactPlaceholder:identifierRoleAcceptedExactPlaceholder4j,identifierRoleAcceptedGenericPlaceholder:identifierRoleAcceptedGenericPlaceholder4j,identifierRoleAcceptedUniqueBuildValue:identifierRoleAcceptedUniqueBuildValue4j,identifierRoleAcceptedQueryKey:identifierRoleAcceptedQueryKey4j,identifierRoleAcceptedPathSegment:identifierRoleAcceptedPathSegment4j,
identifierRoleRejectedEntityMismatch:identifierRoleRejectedEntityMismatch4j,identifierRoleRejectedSecondarySupport:identifierRoleRejectedSecondarySupport4j,identifierRoleRejectedAmbiguousOccurrence:identifierRoleRejectedAmbiguousOccurrence4j,identifierRoleRejectedSubstring:identifierRoleRejectedSubstring4j,identifierRoleRejectedAuthLike:identifierRoleRejectedAuthLike4j,
renderCompileRejected:renderCompileRejected4j,renderUrlParseRejected:renderUrlParseRejected4j,entityIncompatibleStructuralProbeAttempts:entityIncompatibleStructuralProbeAttempts4j,schemaProbeCalls`);

  x=x.replaceAll('4H_TASK_OPERATION_ALIGNMENT:','4J_ENTITY_GATED_IDENTIFIER_ROLE:')
    .replaceAll('4H_SUCCESSFUL_PROBE_MAPPING_REJECT','4J_SUCCESSFUL_PROBE_MAPPING_REJECT')
    .replaceAll('4h_request_hypothesis_not_in_alignment_graph','4j_request_hypothesis_not_in_alignment_graph')
    .replaceAll('GO_4H_TASK_OPERATION_SEMANTIC_ALIGNMENT','GO_4J_ENTITY_GATED_DOCUMENTED_IDENTIFIER_ROLES')
    .replaceAll('REASSESS_4H_TASK_OPERATION_SEMANTIC_ALIGNMENT','REASSESS_4J_ENTITY_GATED_DOCUMENTED_IDENTIFIER_ROLES');

  x=r(x,'experiment:"4H",purpose:"development_task_operation_semantic_alignment"','experiment:"4J",purpose:"development_entity_gated_documented_identifier_roles"');
  x=r(x,'base_sha:"547e72a94345b978cc64fdb18c3330736742a927"','base_sha:"008af94c9f6fb6e8f63b8c40616ede0bbcbc3988"');
  x=r(x,'wrong_task_probe_attempts_zero:wrongTaskProbeAttempts4h===0,',`wrong_task_probe_attempts_zero:wrongTaskProbeAttempts4h===0,
entity_incompatible_structural_probes_zero:entityIncompatibleStructuralProbeAttempts4j===0,
placeholder_preservation_failures_zero:placeholderPreservationFailures4j===0,
non_auth_request_text_mutations_zero:nonAuthRequestTextMutations4j===0,
false_character_books_recipe_absent:!falseCharacterBooksRecipe,`);

  const gateAnchor='const r4CapabilityIds=new Set(["npm_package_metadata","food_barcode_metadata","cocktail_name_metadata","gender_estimate_by_name","artwork_object_metadata","vin_vehicle_metadata"]),r4Recovered=successful.filter(x=>r4CapabilityIds.has(x.case_id)).length,expandedEvidenceRecipes=recipes.filter(r=>r.expanded_evidence_request).length,semanticFailureRate=synthesisCalls?((noOperationAttempts4h+alignmentUnusableAttempts4h)/synthesisCalls):1;';
  x=r(x,gateAnchor,`${gateAnchor.slice(0,-1)},falseCharacterBooksRecipe=recipes.some(r=>r.case_id==="fictional_character_metadata"&&/(?:^|\\/)api\\/books(?:\\/|$)/i.test(String(r.contract?.path_template||"")));`);

  x=x.replaceAll('./experiment4hPlanner.ts','./experiment4jPlanner.ts')
    .replaceAll('./experiment4hRequest.ts','./experiment4jRequest.ts')
    .replaceAll('./experiment4hContract.ts','./experiment4jContract.ts')
    .replaceAll('./experiment4hDerivation.ts','./experiment4jDerivation.ts');
  return x;
}
