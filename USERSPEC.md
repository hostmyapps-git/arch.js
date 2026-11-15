# Ziel

Ziel des Projektes ist das entwickeln einer 
* Sprache für die Dokumentation von Enterprise Architectures
* eines Renderers, der die dokumentierten Inhalte im Browser darstellen kann
* Iconfähigkeit (z.B. json iconpacks)



Ergebnis soll sein
* arch.js 
* arch.min.js
* test.md (mit einem ```arch fence)
* index.html mit Beispielen
sein

## Anforderungen
* alle Objekte müssen human readable dokumentierbar sein
* es muss moderne und sehr gut aussehende Templates für typische graphische Elemente geben (Nodes, Packages, etc.)
* rendering als inline svg
* sinnvolles defaul layout
* Objekte müssen frei positionierbar sein
* edges müssen frei positionierbar und die pfade konfigurierbar sein


## Environment
* installiere dir alle benötigten node packages die du verwenden möchtest

## Referenzen
* [NATO Architecture Framework](ReferenceDocs/nafv4/)
* [Mermaid.js](https://github.com/mermaid-js/mermaid/tree/develop/packages/mermaid/src/docs)
* [Graphviz](https://graphviz.org/documentation/)
* [PlantUML](ReferenceDocs/plantuml/)

## Betrachtung bestehender Ansätze

### PlantUML

#### Nachteile
* nicht im Browser lauffähig (nur über image-generator)
* keine freie Positionierung von Nodes
* Syntax zu komplex

#### Vorteile
* Human Readable
* gute Templates für Standard Nodes (Cluster, Classes)
* Semantik von Node Typen und Diagramm Typen

### Graphviz/Dot

#### Nachteile
* keine echte Semantik von komplexeren Stereotypen
* keine entsprechenden Templates für typische Nodes
* keine Unterscheidung zwischen Semantik und graphischer Representation
* Syntax zu komplex

#### Vorteile
* Human Readable 
* Elemente sind mit verschiedenen Rendering Engines (nop, nop2) frei positionierbar
* über z.B. Viz.js im Browser lauffähig


### Mermaid.js

#### Nachteile
* keine freie Positionierung von nodes möglichen
* keine freie Gestaltung von Edges möglich
* keine Unterscheidung zwischen Semantik und graphischer Representation

#### Vorteile
* Human Readable node@{...}
* Semantik von Node Typen und Diagramm Typen
* im Browser lauffähig


