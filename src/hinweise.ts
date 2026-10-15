// Hinweisliste: ersetzt den Bericht der Export-Anweisung.
// info = nur zur Kenntnis, gelb = Layout unsicher zugeordnet, rot = Layout nicht zugeordnet / Fehler.

export type Stufe = 'info' | 'gelb' | 'rot'

export interface Hinweis {
  stufe: Stufe
  notiz: string // Pfad der Notiz
  text: string
  /** Index des betroffenen Eintrags in der Layout-Datei (für die Knöpfe in der Hinweisliste) */
  layoutEintrag?: number
  /** ausgeblendet = vom Nutzer aus dem Druck genommen (Knopf "Einblenden") */
  art?: 'ausgeblendet' | 'zuordnung'
  /** Block, zu dem der Hinweis gehört (Klick springt dorthin) */
  block?: string
}
