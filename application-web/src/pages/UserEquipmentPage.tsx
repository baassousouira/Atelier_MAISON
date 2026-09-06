import {
  useMemo,
} from 'react'

import type {
  LucideIcon,
} from 'lucide-react'

import {
  Bot,
  Cpu,
} from 'lucide-react'

import EquipmentControl
  from '../components/user/EquipmentControl'

import {
  useSystem,
} from '../hooks/useSystem'

import type {
  Equipment,
  EquipmentGroupKind,
} from '../types/dashboard'


/*
  ============================================================
  GROUPE CALCULÉ DYNAMIQUEMENT
  ============================================================

  Aucun ID d'équipement
  n'est écrit en dur ici.

  Les groupes sont construits
  depuis les métadonnées envoyées
  par le serveur.
*/

type DisplayEquipmentGroup = {
  id: string

  title: string

  description: string

  kind:
    EquipmentGroupKind

  order: number

  equipment:
    Equipment[]
}


/*
  Icône selon le type
  général du groupe.
*/

const groupIcons:
  Record<
    EquipmentGroupKind,
    LucideIcon
  > = {
    FIXED:
      Cpu,

    MOBILE:
      Bot,
  }


function UserEquipmentPage() {
  const {
    equipment,
    serverConnection,
    isLoading,
    dataError,
  } = useSystem()


  const onlineCount =
    equipment.filter(
      (item) =>
        item.status ===
        'ONLINE',
    ).length


  const activeCount =
    equipment.filter(
      (item) =>
        item.enabled,
    ).length


  /*
    ============================================================
    CRÉATION AUTOMATIQUE DES GROUPES
    ============================================================

    Exemple :

    caméra salon :
    groupId = salon

    capteur lumière :
    groupId = salon

    React les placera automatiquement
    ensemble.
  */

  const equipmentGroups =
    useMemo(
      () => {
        const groups =
          new Map<
            string,
            DisplayEquipmentGroup
          >()


        for (
          const item
          of equipment
        ) {
          const existing =
            groups.get(
              item.groupId,
            )


          if (existing) {
            existing
              .equipment
              .push(
                item,
              )

            continue
          }


          groups.set(
            item.groupId,

            {
              id:
                item.groupId,

              title:
                item.groupName,

              description:
                item.groupDescription,

              kind:
                item.groupKind,

              order:
                item.groupOrder ??
                999,

              equipment: [
                item,
              ],
            },
          )
        }


        return [
          ...groups.values(),
        ]
          .map(
            (group) => ({
              ...group,

              equipment:
                [
                  ...group.equipment,
                ].sort(
                  (
                    first,
                    second,
                  ) =>
                    (
                      first.displayOrder ??
                      999
                    ) -
                    (
                      second.displayOrder ??
                      999
                    ),
                ),
            }),
          )
          .sort(
            (
              first,
              second,
            ) =>
              first.order -
              second.order,
          )
      },

      [
        equipment,
      ],
    )


  return (
    <div className="user-page">
      <header className="page-heading">
        <div>
          <p className="page-eyebrow">
            Installation
          </p>

          <h1>
            Équipements
          </h1>

          <p>
            Activez ou désactivez chaque équipement
            et ouvrez sa fiche pour consulter
            son état détaillé.
          </p>
        </div>

        <span
          className={
            `page-status ${
              serverConnection.status ===
              'CONNECTED'
                ? 'is-success'
                : 'is-warning'
            }`
          }
        >
          <Cpu
            aria-hidden="true"
          />

          {onlineCount}

          {' / '}

          {equipment.length}

          {' en ligne'}
        </span>
      </header>


      {/*
        ========================================================
        CHARGEMENT
        ========================================================
      */}

      {isLoading && (
        <div className="empty-state">
          <Cpu
            aria-hidden="true"
          />

          <strong>
            Chargement de l'installation
          </strong>

          <span>
            Lecture des équipements
            depuis le serveur central.
          </span>
        </div>
      )}


      {/*
        ========================================================
        ERREUR
        ========================================================
      */}

      {!isLoading &&
        dataError &&
        equipment.length ===
          0 && (
          <div className="empty-state">
            <Cpu
              aria-hidden="true"
            />

            <strong>
              Données indisponibles
            </strong>

            <span>
              {dataError}
            </span>
          </div>
        )}


      {/*
        ========================================================
        INSTALLATION
        ========================================================
      */}

      {!isLoading &&
        equipment.length >
          0 && (
          <>
            <div className="equipment-summary-row">
              <article>
                <span>
                  Équipements actifs
                </span>

                <strong>
                  {activeCount}

                  {' / '}

                  {
                    equipment.length
                  }
                </strong>
              </article>


              <article>
                <span>
                  Connexion
                </span>

                <strong>
                  {serverConnection.status ===
                  'CONNECTED'
                    ? 'Opérationnelle'
                    : 'Interrompue'}
                </strong>
              </article>
            </div>


            <div className="equipment-overview-grid">
              {equipmentGroups.map(
                (group) => {
                  const Icon =
                    groupIcons[
                      group.kind
                    ]


                  const allOnline =
                    group.equipment.length >
                      0 &&
                    group.equipment.every(
                      (item) =>
                        item.status ===
                        'ONLINE',
                    )


                  return (
                    <section
                      className="equipment-group-card"
                      key={
                        group.id
                      }
                    >
                      <div className="equipment-group-heading">
                        <span className="equipment-group-icon">
                          <Icon
                            aria-hidden="true"
                          />
                        </span>

                        <div>
                          <h2>
                            {
                              group.title
                            }
                          </h2>

                          <p>
                            {
                              group.description
                            }
                          </p>
                        </div>

                        <span
                          className={
                            `equipment-group-status ${
                              allOnline
                                ? 'is-online'
                                : 'is-offline'
                            }`
                          }
                        >
                          <i
                            className={
                              `status-dot ${
                                allOnline
                                  ? 'is-online'
                                  : 'is-offline'
                              }`
                            }
                          />

                          {allOnline
                            ? 'Disponible'
                            : 'À vérifier'}
                        </span>
                      </div>


                      {/*
                        Les équipements sont maintenant
                        de simples sections de la grande carte.

                        Ton CSS actuel supprime leurs
                        sous-cartes.
                      */}

                      <div className="equipment-group-list">
                        {group.equipment.map(
                          (item) => (
                            <EquipmentControl
                              key={
                                item.id
                              }
                              equipment={
                                item
                              }
                              detailsPath={
                                `/utilisateur/equipements/${item.id}`
                              }
                            />
                          ),
                        )}
                      </div>
                    </section>
                  )
                },
              )}
            </div>
          </>
        )}


      {/*
        ========================================================
        INSTALLATION VIDE
        ========================================================
      */}

      {!isLoading &&
        !dataError &&
        equipment.length ===
          0 && (
          <div className="empty-state">
            <Cpu
              aria-hidden="true"
            />

            <strong>
              Aucun équipement
            </strong>

            <span>
              Le serveur ne connaît encore
              aucun équipement pour cette installation.
            </span>
          </div>
        )}
    </div>
  )
}


export default UserEquipmentPage