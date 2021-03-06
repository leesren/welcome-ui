const path = require('path')
const fs = require('fs')
const util = require('util')

fs.readFileAsync = util.promisify(fs.readFile)
fs.readdirAsync = util.promisify(fs.readdir)
fs.writeFileAsync = util.promisify(fs.writeFile)

const rootPath = path.join(__dirname, '..')
const iconPath = path.join(rootPath, 'packages/Icon')
const iconsPath = path.join(rootPath, 'icons')
const inputPath = path.join(iconsPath, '_assets')

// State to hold all icons so we don't have to keep reading all the files
let icons = {}

const toPascalCase = str => {
  const camelCase = str.replace(/_(\w)/g, ($, $1) => $1.toUpperCase())
  return `${camelCase.charAt(0).toUpperCase()}${camelCase.substr(1)}`
}

const readIconFiles = () => fs.readdirAsync(inputPath)

const addAllFiles = files => {
  const promises = files
    .map(file => {
      const [key, type] = file.split('.')
      if (type === 'svg') {
        const fileConf = fs
          .readFileAsync(path.join(inputPath, file), 'utf8')
          .then(content => ({ key, content }))
        return fileConf
      }
    })
    .filter(Boolean)

  // eslint-disable-next-line no-undef
  return Promise.all(promises)
}

const writeContents = (file, content) => {
  let svgContent = /<svg[^>]*>([\s\S]*)<\/svg>/g.exec(content)
  if (svgContent) {
    svgContent = svgContent[1].replace(/fill="#134B45"/g, 'fill="currentColor"').trim()
  }
  fs.writeFileSync(file, getContent(svgContent))
}

const writePackageJson = (file, key) => {
  let iconRootConfig = fs.readFileSync(`${iconPath}/package.json`)
  iconRootConfig = JSON.parse(iconRootConfig.toString())

  let config = {}
  if (fs.existsSync(file)) {
    config = fs.readFileSync(file)
    config = JSON.parse(config.toString())
  }
  icons[key] = {
    name: toPascalCase(key),
    version: config.version
  }
  fs.writeFileSync(file, getPackageJsonContent(config, key, iconRootConfig.version))
}

const updateIcons = files => {
  files.forEach(({ content, key }) => {
    // Create folder if necessary
    const iconName = toPascalCase(key)
    const outputFolder = `${iconsPath}/${iconName}`
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder)
    }
    // package.json
    writePackageJson(`${outputFolder}/package.json`, key)
    // .npmignore
    fs.writeFileSync(`${outputFolder}/.npmignore`, getNpmIgnoreContent())
    // contents.js
    writeContents(`${outputFolder}/content.js`, content)
    // index.js
    fs.writeFileSync(`${outputFolder}/index.js`, getIndexContent(iconName))

    return key
  })

  // Write main icons/index.js
  const rootIndexContent = files.reduce((acc, { key }) => {
    const iconName = toPascalCase(key)
    return `${acc}
    export { ${iconName}Icon } from '@welcome-ui/icons.${key}'`
  }, '')
  fs.writeFileSync(`${iconsPath}/index.js`, rootIndexContent)

  // Write main icons/package.json
  let config = fs.readFileSync(`${iconsPath}/package.json`)
  config = JSON.parse(config.toString())

  // Get versions of each icon
  const dependencies = files.reduce((acc, { key }) => {
    acc[`@welcome-ui/icons.${key}`] = `^${icons[key].version}`
    return acc
  }, {})
  const rootPackageJsonContent = {
    ...config,
    dependencies
  }
  fs.writeFileSync(
    `${iconsPath}/package.json`,
    `${JSON.stringify(rootPackageJsonContent, 0, 2)}
`
  )

  return
}

const writeIcons = readIconFiles()
  .then(addAllFiles)
  .then(updateIcons)
  // eslint-disable-next-line no-console
  .then(() => console.log('SVGs successfully written to json'))
  .catch(err => {
    throw err
  })

// .npmignore
const getNpmIgnoreContent = () => `/*
!/dist/*.js
`

// index.js
const getIndexContent = iconName => `import React from 'react'
import { Icon } from '@welcome-ui/icon'
import content from './content.js'
export const ${iconName}Icon = props => <Icon content={content} alt="${iconName}" {...props} />
`

// package.json
const getPackageJsonContent = (config, key, iconVersion) => {
  const content = {
    ...config,
    name: `@welcome-ui/icons.${key}`,
    sideEffects: false,
    main: `dist/icons.${key}.cjs.js`,
    module: `dist/icons.${key}.es.js`,
    version: config.version || '1.0.0',
    publishConfig: {
      access: 'public'
    },
    dependencies: {
      '@welcome-ui/icon': `^${iconVersion}`
    },
    peerDependencies: {
      react: '^16.10.2',
      'react-dom': '^16.10.2'
    },
    license: 'MIT'
  }
  return `${JSON.stringify(content, 0, 2)}
`
}

// content.js
const getContent = svgContent => `export default {
  width: 15,
  height: 15,
  block:
    '${svgContent}'
}
`

module.exports = {
  writeIcons,
  readIconFiles,
  addAllFiles
}
