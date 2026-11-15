# Architektur in Markdown

Dieses Dokument kann mit arch.renderMarkdown(text) direkt als sicheres HTML mit Inline-SVG gerendert werden.

## Automatisches Layout

```arch
architecture "Customer experience" {
  description "Ein lesbares Modell für den Weg vom Kunden bis zu den Daten."
  model {
    person customer "Kunde"
    package platform "Digitale Plattform" {
      application portal "Kundenportal" { technology "Web · Mobile" }
      service api "Kundenservice" { description "Ein gemeinsamer Zugang zu den Kundendaten." }
      database data "Kundendaten" { technology "PostgreSQL" }
    }
    relation uses customer -> portal "Verwendet"
    relation calls portal -> api "HTTPS"
    relation reads api -> data "Liest / schreibt" { type access }
  }
  view overview "Systemübersicht" {
    direction right
    route uses { curve rounded }
    route calls { curve rounded }
  }
}
```

## Freie Platzierung und Kantenführung

Negative Koordinaten, feste Größen, Ports, Wegpunkte und explizite Labelpositionen sind möglich.

```arch
architecture "Event-Verarbeitung" {
  model {
    service producer "Produzent" { technology "Node.js" }
    queue events "Ereignisse" { technology "Kafka" }
    service consumer "Konsument" { technology "Python" }
    relation publishes producer -> events "Publiziert"
    relation consumes events -> consumer "Abonniert" { type dependency }
    relation feedback consumer -> producer "Rückmeldung"
  }
  view precise "Technische Sicht" {
    place producer at (-100, 0)
    place events at (260, 0) size (240, 150)
    place consumer at (640, 0)
    style producer { template component accent "#8b5cf6" icon core.cloud }
    route publishes { from right to left curve straight }
    route consumes { from right to left curve bezier via (550, 75), (590, 56) }
    route feedback {
      from bottom
      to bottom
      via (750, 240), (10, 240)
      curve rounded
      label (380, 240)
    }
  }
}
```

## Normale Codeblöcke bleiben Code

```javascript
const html = arch.renderMarkdown(markdown);
document.querySelector('#content').innerHTML = html;
```
