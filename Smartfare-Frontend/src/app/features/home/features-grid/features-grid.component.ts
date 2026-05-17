import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface CapabilityStage {
  id: string;
  eyebrow: string;
  headline: string;
  description: string;
  bullets: string[];
  route: string;
  cta: string;
  primaryImage: string;
  primaryUrl: string;
  secondaryImage: string;
  secondaryLabel: string;
  stackWord: string;
  layout: 'left' | 'right';
  triggerCopy: string;
}

@Component({
  selector: 'app-features-grid',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './features-grid.component.html',
  styleUrl: './features-grid.component.css',
})
export class FeaturesGridComponent implements AfterViewInit, OnDestroy {
  @ViewChild('sectionRoot', { static: true })
  private readonly sectionRoot?: ElementRef<HTMLElement>;

  @ViewChildren('stageTrigger')
  private readonly stageTriggers!: QueryList<ElementRef<HTMLElement>>;

  protected readonly activeStageIndex = signal(0);
  protected readonly stages: CapabilityStage[] = [
    {
      id: 'planner',
      eyebrow: 'Planner interattivo',
      headline: 'Costruisci il viaggio mentre la mappa reagisce in tempo reale.',
      description:
        'SmartFare deve sembrare uno strumento vivo: trascini tappe, cambi ordine, vedi la rotta e capisci subito come si sta formando il viaggio.',
      bullets: [
        'Mappe leggibili anche con piu tappe',
        'Bozza pronta gia durante la costruzione',
        'Transizione naturale da idea a piano reale',
      ],
      route: '/itineraries/new',
      cta: 'Apri il planner',
      primaryImage: 'assets/preview.png',
      primaryUrl: 'smartfare.app/itineraries/new',
      secondaryImage: 'assets/preview2.png',
      secondaryLabel: 'Route building',
      stackWord: 'Planner',
      layout: 'right',
      triggerCopy: 'Scorri e vedi come la piattaforma accompagna la creazione della rotta.',
    },
    {
      id: 'saved-trips',
      eyebrow: 'Libreria itinerari',
      headline: 'Riapri i tuoi viaggi come una raccolta ordinata e visuale.',
      description:
        'La seconda scena deve mostrare che SmartFare non finisce nella creazione: conserva, organizza e rende riapribili i viaggi migliori senza confusione.',
      bullets: [
        'Archivio leggibile dei viaggi salvati',
        'Anteprime che fanno capire subito dove entrare',
        'Piacevole da scorrere, non solo utile da usare',
      ],
      route: '/profile/itineraries',
      cta: 'Guarda la raccolta',
      primaryImage: 'assets/preview2.png',
      primaryUrl: 'smartfare.app/profile/itineraries',
      secondaryImage: 'assets/preview.png',
      secondaryLabel: 'Saved trips',
      stackWord: 'Itineraries',
      layout: 'left',
      triggerCopy: 'La pagina deve raccontare il lato collezione del prodotto, non solo il builder.',
    },
    {
      id: 'ai',
      eyebrow: 'AI planner',
      headline: 'Parla in modo naturale e trasforma il prompt in un itinerario concreto.',
      description:
        'Qui deve arrivare la sensazione di intelligenza assistita: l AI aiuta davvero, ma il risultato resta chiaro, modificabile e pronto da portare nel planner.',
      bullets: [
        'Prompt semplici per road trip, weekend o city break',
        'Risposte che diventano una base di lavoro vera',
        'Dal dialogo alla rotta senza salto di contesto',
      ],
      route: '/voyager',
      cta: 'Parla con l AI',
      primaryImage: 'assets/preview3.png',
      primaryUrl: 'smartfare.app/voyager',
      secondaryImage: 'assets/preview.png',
      secondaryLabel: 'AI planning',
      stackWord: 'AI',
      layout: 'right',
      triggerCopy: 'L ultima scena chiude il racconto mostrando che l AI genera slancio, non solo testo.',
    },
  ];
  protected readonly capabilityWords = ['Planner', 'Trips', 'Itineraries', 'AI', 'Maps', 'Routes'];
  protected readonly activeStage = computed(
    () => this.stages[this.activeStageIndex()] ?? this.stages[0]
  );

  private stageObserver?: IntersectionObserver;

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.stageObserver = new IntersectionObserver(
        (entries) => {
          const activeEntry = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

          if (!activeEntry) {
            return;
          }

          const stageIndex = Number(
            (activeEntry.target as HTMLElement).dataset['stageIndex'] ?? 0
          );

          if (Number.isFinite(stageIndex)) {
            this.activeStageIndex.set(stageIndex);
          }
        },
        {
          threshold: [0.25, 0.5, 0.75],
          rootMargin: '-28% 0px -28% 0px',
        }
      );

      this.stageTriggers.forEach((triggerRef, index) => {
        triggerRef.nativeElement.dataset['stageIndex'] = String(index);
        this.stageObserver?.observe(triggerRef.nativeElement);
      });
    });
  }

  ngOnDestroy(): void {
    this.stageObserver?.disconnect();
  }
}
