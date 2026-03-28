import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
  Inject,
  PLATFORM_ID,
  signal,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import * as echarts from 'echarts';
import { tunisiaGeoJson } from './tunisia-map';
import { GOVERNORATE_LABEL_EN, GOVERNORATE_LABEL_FR } from './tunisia-governorate-labels';
import { ExploreService } from './explore/explore.service';

const TUNISIA_MAP_NAME_PROP = '_echartsRegionId';
const HOME_MAP_RETURN_CONTEXT_KEY = 'homeMapReturnContext';

function tunisiaGeoWithUniqueRegionIds(geo: any) {
  return {
    ...geo,
    features: geo.features.map((f: any, i: number) => ({
      ...f,
      properties: {
        ...f.properties,
        [TUNISIA_MAP_NAME_PROP]: `${f.properties?.gouv_id ?? 'region'}_${i}`,
      },
    })),
  };
}

function buildRegionIdToLabel(mapGeo: any): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of mapGeo.features) {
    const regionId = f.properties[TUNISIA_MAP_NAME_PROP];
    const gid = f.properties?.gouv_id as string | undefined;
    const rawFr = f.properties?.gouv_fr as string | undefined;
    const label =
      (gid ? GOVERNORATE_LABEL_EN[gid] : undefined) ??
      (gid ? GOVERNORATE_LABEL_FR[gid] : undefined) ??
      rawFr ??
      regionId;
    m.set(regionId, label);
  }
  return m;
}

function normalizeRegionToken(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

@Component({
  selector: 'app-destination-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './destination-map.component.html',
  styleUrl: './destination-map.component.css',
})
export class DestinationMapComponent implements AfterViewInit {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  mapViewMode = signal<'local' | 'highlights'>('local');
  selectedRegion = signal<{
    name: string;
    description: string;
    cityId: number | null;
    resolving: boolean;
    mapRegionId: string | null;
  } | null>(null);
  isMapNavigating = signal(false);

  private tunisiaMapChart?: echarts.ECharts;
  private mapGeoData?: any;
  private regionIdToLabelMap?: Map<string, string>;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private readonly exploreService: ExploreService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initMap();
      this.playReturnZoomOutIfRequested();
    }
  }

  setMapView(mode: 'local' | 'highlights'): void {
    if (this.mapViewMode() === mode) return;
    this.mapViewMode.set(mode);
    this.applyMapTheme();
  }

  initMap() {
    const mapGeo = tunisiaGeoWithUniqueRegionIds(tunisiaGeoJson);
    this.mapGeoData = mapGeo;
    this.regionIdToLabelMap = buildRegionIdToLabel(mapGeo);

    echarts.registerMap('Tunisia', mapGeo);
    this.tunisiaMapChart = echarts.init(this.mapContainer.nativeElement);

    this.applyMapTheme();

    this.tunisiaMapChart.on('click', (params: any) => {
      const label = this.displayName(params);
      this.selectedRegion.set({
        name: label,
        description: `Exploring ${label}...`,
        cityId: null,
        resolving: true,
        mapRegionId: params?.name ?? null,
      });

      this.exploreService.resolveCityByName(label).subscribe({
        next: (resolved) => {
          this.selectedRegion.set({
            name: resolved.city.name,
            description:
              resolved.city.description ||
              `Discover ${resolved.city.name}, a Tunisian destination rich in experiences.`,
            cityId: resolved.city.cityId,
            resolving: false,
            mapRegionId: params?.name ?? null,
          });
          this.cdr.detectChanges();
        },
        error: () => {
          this.selectedRegion.update((prev) =>
            prev
              ? {
                  ...prev,
                  description:
                    `No linked city found in the database for ${label}.`,
                  cityId: null,
                  resolving: false,
                  mapRegionId: params?.name ?? null,
                }
              : null
          );
          this.cdr.detectChanges();
        },
      });

      this.cdr.detectChanges();
    });

    window.addEventListener('resize', () => {
      this.tunisiaMapChart?.resize();
    });
  }

  goToSelectedCity(): void {
    const region = this.selectedRegion();
    if (!region?.cityId || region.resolving) {
      return;
    }

    this.isMapNavigating.set(true);
    this.zoomToRegion(region.mapRegionId);
    setTimeout(() => {
      this.router.navigate(['/city', region.cityId], {
        queryParams: {
          region: region.mapRegionId ?? undefined,
        },
      });
      this.isMapNavigating.set(false);
    }, 680);
  }

  private displayName(p: { name?: string; data?: any }): string {
    const m = this.regionIdToLabelMap!;
    return m.get(p.name ?? '') ?? p.data?.gouv_fr ?? p.name ?? '';
  }

  private applyMapTheme(): void {
    if (!this.tunisiaMapChart || !this.mapGeoData) return;

    const mapGeo = this.mapGeoData;
    const displayName = (p: any) => this.displayName(p);
    const mode = this.mapViewMode();
    const isLocal = mode === 'local';

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item' as const,
        formatter: (p: any) => displayName(p),
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: '#e8002d',
        textStyle: { color: '#fff' },
      },
      visualMap: {
        show: false,
        min: 0,
        max: 24,
        inRange: {
          color: isLocal
            ? ['#0b0c10', '#1a1c23', '#2a2d39', '#e8002d', '#0077b6']
            : ['#1a1510', '#2d2418', '#5c3d2e', '#e85d04', '#ffd166'],
        },
      },
      series: [
        {
          type: 'map' as const,
          map: 'Tunisia',
          nameProperty: TUNISIA_MAP_NAME_PROP,
          zoom: 1.2,
          aspectScale: 0.9,
          selectedMode: 'single' as const,
          itemStyle: isLocal
            ? {
                areaColor: '#12141a',
                borderColor: '#1a1c23',
                borderWidth: 2,
                shadowColor: 'rgba(232, 0, 45, 0.45)',
                shadowBlur: 22,
                shadowOffsetX: 4,
                shadowOffsetY: 12,
              }
            : {
                areaColor: '#1e222d',
                borderColor: 'rgba(232, 0, 45, 0.35)',
                borderWidth: 1.5,
                shadowColor: 'rgba(244, 162, 97, 0.4)',
                shadowBlur: 26,
                shadowOffsetX: 2,
                shadowOffsetY: 10,
              },
          emphasis: {
            label: {
              show: true,
              color: '#ffffff',
              fontSize: isLocal ? 16 : 17,
              fontWeight: 'bold' as const,
              formatter: (p: any) => displayName(p),
            },
            itemStyle: isLocal
              ? {
                  areaColor: '#e8002d',
                  borderColor: '#ff4b4b',
                  shadowColor: 'rgba(232, 0, 45, 0.8)',
                  shadowBlur: 15,
                }
              : {
                  areaColor: '#f4a261',
                  borderColor: '#ffe066',
                  shadowColor: 'rgba(255, 209, 102, 0.55)',
                  shadowBlur: 20,
                },
          },
          select: {
            label: {
              show: true,
              color: '#ffffff',
              fontSize: 18,
              fontWeight: 'bold' as const,
              formatter: (p: any) => displayName(p),
            },
            itemStyle: {
              areaColor: isLocal ? '#e8002d' : '#e85d04',
              borderColor: '#ffffff',
              borderWidth: 2,
            },
          },
          data: mapGeo.features.map((f: any, index: number) => ({
            name: f.properties[TUNISIA_MAP_NAME_PROP],
            value: index % 5,
            gouv_fr: f.properties.gouv_fr,
          })),
        },
      ],
    };

    this.tunisiaMapChart.setOption(option, { notMerge: true });
  }

  private playReturnZoomOutIfRequested(): void {
    const stored = this.readStoredReturnContext();

    const zoomOut =
      this.route.snapshot.queryParamMap.get('zoomOut') ??
      (stored ? String(stored.zoomOut ?? '') : null);
    const returnRegion =
      this.route.snapshot.queryParamMap.get('returnRegion') ?? stored?.returnRegion ?? null;
    const returnCity =
      this.route.snapshot.queryParamMap.get('returnCity') ?? stored?.returnCity ?? null;

    const returnCityIdRaw =
      this.route.snapshot.queryParamMap.get('returnCityId') ??
      (stored?.returnCityId !== undefined && stored?.returnCityId !== null
        ? String(stored.returnCityId)
        : null);

    const returnLatRaw =
      this.route.snapshot.queryParamMap.get('returnLat') ??
      (stored?.returnLat !== undefined && stored?.returnLat !== null
        ? String(stored.returnLat)
        : null);

    const returnLngRaw =
      this.route.snapshot.queryParamMap.get('returnLng') ??
      (stored?.returnLng !== undefined && stored?.returnLng !== null
        ? String(stored.returnLng)
        : null);

    const returnCityId = returnCityIdRaw ? Number(returnCityIdRaw) : null;
    const returnLat = returnLatRaw ? Number(returnLatRaw) : null;
    const returnLng = returnLngRaw ? Number(returnLngRaw) : null;

    if (zoomOut !== '1' || !this.tunisiaMapChart) {
      return;
    }

    const featureFromParams = this.findMapFeatureByTokens([returnRegion, returnCity]);

    if (
      returnLat !== null &&
      returnLng !== null &&
      !Number.isNaN(returnLat) &&
      !Number.isNaN(returnLng)
    ) {
      this.runReturnZoomOutAnimationFromCenter(
        [returnLng, returnLat],
        this.getFeatureRegionId(featureFromParams),
        returnCity,
        returnCityId
      );
      return;
    }

    if (featureFromParams) {
      this.runReturnZoomOutAnimation(featureFromParams, returnCity, returnCityId);
      return;
    }

    if (!returnCityId || Number.isNaN(returnCityId)) {
      this.clearReturnQueryParams();
      return;
    }

    this.exploreService.getCityDetails(returnCityId).subscribe({
      next: (details) => {
        const featureFromCityDetails = this.findMapFeatureByTokens([
          details.city.region,
          details.city.name,
          returnRegion,
          returnCity,
        ]);

        if (featureFromCityDetails) {
          this.runReturnZoomOutAnimation(
            featureFromCityDetails,
            details.city.name,
            details.city.cityId
          );
          return;
        }
        this.clearReturnQueryParams();
      },
      error: () => {
        this.clearReturnQueryParams();
      },
    });
  }

  private findMapFeatureByTokens(tokens: Array<string | null | undefined>): any | null {
    const normalizedCandidates = tokens
      .map((value) => normalizeRegionToken(value))
      .filter((value) => !!value);

    if (!normalizedCandidates.length || !this.mapGeoData?.features) {
      return null;
    }

    return (
      this.mapGeoData.features.find((item: any) => {
        const uniqueId = item?.properties?.[TUNISIA_MAP_NAME_PROP];
        const governorateId = item?.properties?.gouv_id;
        const governorateName = item?.properties?.gouv_fr;
        const mappedLabel = uniqueId ? this.regionIdToLabelMap?.get(uniqueId) : null;

        const normalizedTokens = [
          normalizeRegionToken(uniqueId),
          normalizeRegionToken(governorateId),
          normalizeRegionToken(governorateName),
          normalizeRegionToken(mappedLabel),
        ];

        return normalizedCandidates.some((candidate) =>
          normalizedTokens.includes(candidate)
        );
      }) ?? null
    );
  }

  private runReturnZoomOutAnimation(
    feature: any,
    cityLabel?: string | null,
    cityId?: number | null
  ): void {
    const center = this.extractFeatureCenter(feature.geometry);
    if (!center || !this.tunisiaMapChart) {
      return;
    }

    this.runReturnZoomOutAnimationFromCenter(
      center,
      this.getFeatureRegionId(feature),
      cityLabel,
      cityId
    );
  }

  private runReturnZoomOutAnimationFromCenter(
    center: [number, number],
    selectedMapRegionId: string | null = null,
    cityLabel?: string | null,
    cityId?: number | null
  ): void {
    if (!this.tunisiaMapChart) {
      return;
    }

    this.mapViewMode.set('local');
    this.applyMapTheme();

    this.scrollToMapSectionForReturn();

    setTimeout(() => {
      this.tunisiaMapChart?.resize();
      this.tunisiaMapChart?.setOption({
        series: [
          {
            nameProperty: TUNISIA_MAP_NAME_PROP,
            zoom: 2.55,
            center,
            animationDurationUpdate: 0,
          },
        ],
      });

      this.applyRegionSelection(selectedMapRegionId);
      if (selectedMapRegionId) {
        const selectedName =
          cityLabel ?? this.regionIdToLabelMap?.get(selectedMapRegionId) ?? 'Selected city';
        this.selectedRegion.set({
          name: selectedName,
          description: `Exploring ${selectedName}...`,
          cityId: cityId ?? null,
          resolving: false,
          mapRegionId: selectedMapRegionId,
        });
      }

      setTimeout(() => {
        this.tunisiaMapChart?.setOption({
          series: [
            {
              nameProperty: TUNISIA_MAP_NAME_PROP,
              zoom: 1.2,
              center: [9.4, 34.0],
              animationDurationUpdate: 1250,
              animationEasingUpdate: 'cubicInOut',
            },
          ],
        });

        this.isMapNavigating.set(false);
        setTimeout(() => {
          this.applyRegionSelection(null);
          this.selectedRegion.set(null);
          this.clearReturnQueryParams();
        }, 1320);
      }, 260);
    }, 260);
  }

  private scrollToMapSectionForReturn(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const mapSection = document.getElementById('map-section');
    if (!mapSection) {
      return;
    }

    mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private getFeatureRegionId(feature: any): string | null {
    return feature?.properties?.[TUNISIA_MAP_NAME_PROP] ?? null;
  }

  private applyRegionSelection(regionId: string | null): void {
    if (!this.tunisiaMapChart || !this.mapGeoData?.features) {
      return;
    }

    for (const feature of this.mapGeoData.features) {
      const id = feature?.properties?.[TUNISIA_MAP_NAME_PROP];
      if (!id) {
        continue;
      }
      this.tunisiaMapChart.dispatchAction({
        type: 'mapUnSelect',
        seriesIndex: 0,
        name: id,
      });
    }

    if (!regionId) {
      return;
    }

    this.tunisiaMapChart.dispatchAction({
      type: 'mapSelect',
      seriesIndex: 0,
      name: regionId,
    });
  }

  private clearReturnQueryParams(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.sessionStorage.removeItem(HOME_MAP_RETURN_CONTEXT_KEY);
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete('zoomOut');
      currentUrl.searchParams.delete('returnRegion');
      currentUrl.searchParams.delete('returnCity');
      currentUrl.searchParams.delete('returnCityId');
      currentUrl.searchParams.delete('returnLat');
      currentUrl.searchParams.delete('returnLng');
      currentUrl.hash = 'map-section';
      window.history.replaceState(window.history.state, '', currentUrl.toString());
      return;
    }
  }

  private readStoredReturnContext(): {
    zoomOut?: number | string;
    returnRegion?: string;
    returnCity?: string;
    returnCityId?: number | string;
    returnLat?: number | string;
    returnLng?: number | string;
  } | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const raw = window.sessionStorage.getItem(HOME_MAP_RETURN_CONTEXT_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      window.sessionStorage.removeItem(HOME_MAP_RETURN_CONTEXT_KEY);
      return null;
    }
  }

  private zoomToRegion(mapRegionId: string | null): void {
    if (!this.tunisiaMapChart || !mapRegionId || !this.mapGeoData?.features) {
      return;
    }

    const feature = this.mapGeoData.features.find(
      (item: any) => item?.properties?.[TUNISIA_MAP_NAME_PROP] === mapRegionId
    );

    if (!feature) {
      return;
    }

    const center = this.extractFeatureCenter(feature.geometry);
    if (!center) {
      return;
    }

    this.tunisiaMapChart.setOption({
      series: [
        {
          nameProperty: TUNISIA_MAP_NAME_PROP,
          zoom: 2.4,
          center,
          animationDurationUpdate: 620,
          animationEasingUpdate: 'cubicInOut',
        },
      ],
    });
  }

  private extractFeatureCenter(geometry: any): [number, number] | null {
    const points: [number, number][] = [];

    const walk = (node: any): void => {
      if (!Array.isArray(node)) {
        return;
      }

      if (
        node.length >= 2 &&
        typeof node[0] === 'number' &&
        typeof node[1] === 'number'
      ) {
        points.push([node[0], node[1]]);
        return;
      }

      for (const child of node) {
        walk(child);
      }
    };

    walk(geometry?.coordinates);
    if (!points.length) {
      return null;
    }

    const sum = points.reduce(
      (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
      [0, 0]
    );

    return [sum[0] / points.length, sum[1] / points.length];
  }
}
