// useCompany.ts

// -----------------------------------------------------------------------
// HOOK D'ACCÈS AU CONTEXTE ENTREPRISE
// -----------------------------------------------------------------------
//
// Les pages entreprise utilisent :
//
// const {
//   alerts,
//   customers,
//   openAlert,
//   ...
// } = useCompany()
//
// au lieu d'importer directement CompanyContext.
//
// -----------------------------------------------------------------------

import {
  useContext,
} from 'react'

import {
  CompanyContext,
} from '../contexts/company-context'


export function useCompany() {

  const context =
    useContext(
      CompanyContext,
    )


  // ---------------------------------------------------------------------
  // PROTECTION CONTRE UNE MAUVAISE UTILISATION
  // ---------------------------------------------------------------------
  //
  // Si une page utilise useCompany() sans être placée sous :
  //
  // <CompanyProvider>
  //
  // cette erreur indique immédiatement le problème.
  // ---------------------------------------------------------------------

  if (
    context ===
      undefined
  ) {

    throw new Error(
      (
        'useCompany() doit être utilisé '
        + 'à l’intérieur de <CompanyProvider>.'
      ),
    )
  }


  return context
}