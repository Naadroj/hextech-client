/**
 * Barrel : les types du domaine « données statiques » vivent désormais dans
 * `src/shared/staticdata-types.ts` (partagés main / moteur / renderer). Ce
 * fichier est conservé pour ne pas casser les imports relatifs `./types` du
 * pipeline.
 */
export * from '../../shared/staticdata-types'
