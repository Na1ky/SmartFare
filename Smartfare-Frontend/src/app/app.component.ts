import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AlertComponent } from './features/ui/alert/alert.component';
import { AppLoaderComponent } from './features/ui/loader/loader.component';
import { LoaderService } from './core/services/loader.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AlertComponent, AppLoaderComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  private readonly loaderService = inject(LoaderService);

  readonly isLoading = this.loaderService.isLoading;
  readonly loaderMessage = this.loaderService.message;
}
