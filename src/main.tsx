import { render } from 'preact'
import { site } from '../site.config'

render(<h1>{site.name}</h1>, document.getElementById('app')!)
