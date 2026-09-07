// useSystem.ts

// -----------------------------------------------------------------------
// Hook permettant à n'importe quelle page React
// d'accéder facilement au SystemProvider.
//
// Exemple :
//
// const {
//   equipment,
//   isArmed,
// } = useSystem()
// -----------------------------------------------------------------------


import {
  useContext,
} from 'react'


import {
  SystemContext,
} from '../contexts/system-context'


export function useSystem() {

  const context =
    useContext(
      SystemContext,
    )


  // Cette erreur indique un problème
  // de structure React :
  //
  // le composant utilise useSystem()
  // mais n'est pas placé dans SystemProvider.

  if (
    context === undefined
  ) {

    throw new Error(
      (
        'useSystem doit être utilisé '
        + 'dans un SystemProvider.'
      ),
    )
  }


  return context
}