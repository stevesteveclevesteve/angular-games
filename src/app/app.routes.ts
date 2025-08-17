import { Routes } from '@angular/router';
import { HungryHipposComponent } from './hungry-hippos.component';
import { WordleyDurdleyComponent } from './wordley-durdley.component';
import { PheasantHuntComponent } from './pheasant-hunt.component';
import { WhackAMoleComponent } from './whack-a-mole.component';

export const routes: Routes = [
  { path: '', redirectTo: '/wordley-durdley', pathMatch: 'full' },
  { path: 'hungry-hippos', component: HungryHipposComponent },
  { path: 'wordley-durdley', component: WordleyDurdleyComponent },
  { path: 'pheasant-hunt', component: PheasantHuntComponent },
  { path: 'whack-a-mole', component: WhackAMoleComponent },
  { path: '**', redirectTo: '/wordley-durdley' }
];
