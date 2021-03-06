# Display Whisper
> Media display software for projection.

A media display program, built on [Electron](https://electronjs.org/).  
Built to project songs, text, & image slideshows.

## Info

Made by Brett Doyle - [brettdoyle.art](https://brettdoyle.art) | [contact@brettdoyle.art](mailto:contact@brettdoyle.art?subject=Display%20Whisper)

Distributed under the MIT license. See ``LICENSE.md`` for more information

# Download
Downloads can be found in the [builds](https://github.com/brttd/display-whisper/tree/builds/latest) branch.


### Requirements
* [Git](https://git-scm.com/)
* [Node.JS](https://nodejs.org/en/)

## Get started
```
git clone https://github.com/brttd/display-whisper.git

cd display-whisper
```

## Dependencies
The main *package.json* has only development dependencies, mainly:  
[Electron](https://github.com/electron/electron) (Display Whisper runs on Electron)  
[Asar](https://github.com/electron/asar) (For storing app code & assets in a single file)  
[License Checker](https://github.com/davglass/license-checker) (For creating a list of licenses for modules used)  
[Electron Packager](https://github.com/electron-userland/electron-packager) (For creating app packages)  
(There are a few others used for build scripts, etc).  

### Installation and running
The node modules need to be installed, and then it can be run.  
(If a build step for the asar file is needed, it will automatically run)
```
npm install

npm run start
```

## app.asar
Display Whisper uses an asar package to combine most of its code files into one source file. This file is located in *"app/app.asar"*.
When Display Whisper is run it will load most code and files from the *app.asar* file.
Not all files are stored in the *app.asar* file; the [font-list](https://github.com/oldj/node-font-list) module does not work when run from an asar file, and so is kept external to the *app.asar* file.  

The *app.asar* file is not stored in the Display Whisper repository (since it only contains source code & assets which are in the repository). It can be created with the `asar` script (```npm run asar```).  
Because code is loaded from the *app.asar* file, any changes made to local code files will not be included when running Display Whisper, unless the *app.asar* file is also updated.  
This can be changed; to make Display Whisper load the files directly (instead of from the *app.asar* file), uncomment the second line for appPath in `main.js`:
```
let appPath = path.join(app.getAppPath(), '/app.asar')
..
//appPath = path.normalize(app.getAppPath())
```
Uncommenting the second line will make all code load directly from the *app* folder, instead of from *app/app.asar*.

## Running
Because of the asar file, there are three ways to run Display Whisper (when developing):

* ```npm run start```: Will check for the *app.asar* file before running the app. If there isn't one, it will run the ```asar``` script.
* ```npm run fresh-start```: Will run `asar` script, and then run the app.
* ```npm run launch```: Will run the app directly, without checking for the existence of the *app.asar* file.

## Building

The `build` script (```npm run build```) creates an app package for the host platform.  
This will run the `asar` script, and do all other setup for packaging the app.  

The `build-all` script (```npm run build-all```) creates packages for Windows & Mac (using `electron-packager`), and then switches to the `builds` branch, and puts zipped copies into a folder with the version number. It also updates the `latest` folder.   
This is used for updating the repository builds branch, and **should not be used** in any development environment.