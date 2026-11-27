import React from 'react';
import PropTypes from 'prop-types';
import cn from 'classnames';
import TranslatedComponent from './TranslatedComponent';
import Router from '../Router';
import Persist from '../stores/Persist';
import { Ships } from 'coriolis-data/dist';
import { Download } from './SvgIcons';
import { outfitURL } from '../utils/UrlGenerators';
import { shipFromEdsyText } from '../utils/ImportFormatsEDSY';
import { shipFromInaraSlef } from "../utils/ImportFormatsInara";
import { shipFromCompanionApi } from "../utils/ImportFormatsCompanionApi";
import { shipFromCoriolisDetailedFormat, shipFromCoriolisSingleShipFormat, backupFromCoriolisFullBackupFormat } from "../utils/ImportFormatsCoriolis";
import { shipFromEdGameEngineJournalFileLoadoutEvent } from "../utils/ImportFormatsFrontier";

const dataFormats = {
  /**
   * Test if importString matches EDSY (Elite: Dangerous Shipyard) text format signature
   * @param importString
   * @returns {boolean}
   */
  isEdsyTextFormat: function(importString) {
    const textBuildRegex = new RegExp('^\\[([\\w \\-]+)\\]( \\[([+\\d]+)\\])?\r?\n');

    return textBuildRegex.test(importString); // EDSY build text
  },

  /**
   * Test if importJSON matches the Inara SLEF (Ship Loadout Exchange Format) JSON format signature
   * @param importJson the JSON Object to check for a signature match
   * @returns {boolean} true if importJSON matches the signature, false otherwise
   */
  isInaraSlefFormat: function(importJson) {
    return Boolean(importJson?.[0]?.header?.appName); // We assume only the SLEF format has this envelope data, so if it is present (see: https://inara.cz/elite/inara-impexp-slef/)
  },

  /**
   * Test if importJSON matches the Companion Api single ship JSON format signature
   * @param importJson the JSON Object to check for a signature match
   * @returns {boolean} true if importJSON matches the signature, false otherwise
   */
  isCompanionApiSingleShipFormat: function(importJson) {
    return Boolean(importJson.modules != null && importJson.modules.Armour != null); // Only the Companion API has this information
  },

  /**
   Test if importJSON matches the Companion Api full data dump JSON format signature
   * @param importJson the JSON Object to check for a signature match
   * @returns {boolean} true if importJSON matches the signature, false otherwise
   */
  isCompanionApiFullDataFormat: function(importJson) {
    return Boolean(importJson.ship != null && importJson.ship.modules != null && importJson.ship.modules.Armour != null); // Only the Companion API has this information
  },

  /**
   * Test if importJSON matches our own Coriolis.io detailed export JSON format signature
   * @param importJson the JSON Object to check for a signature match
   * @returns {boolean} true if importJSON matches the signature, false otherwise
   */
  isCoriolisDetailedExportFormat: function(importJson) {
    return Boolean(importJson instanceof Array); // Must be Coriolis detailed export json (i.e. an array of ships in https://coriolis.io/schemas/ship-loadout/5.json format)
  },

  /**
   * Test if importJSON matches our own Coriolis.io single ship export JSON format signature
   * @param importJson the JSON Object to check for a signature match
   * @returns {boolean} true if importJSON matches the signature, false otherwise
   */
  isCoriolisSingleShipFormat: function(importJson) {
    return Boolean(importJson.ship && typeof importJson.name !== undefined); // Must be Coriolis single ship export json (i.e. a single ships in https://coriolis.io/schemas/ship-loadout/5.json format)
  },

  /**
   * Test if importJSON matches our own Coriolis.io full application backup JSON format signature
   * @param importJson the JSON Object to check for a signature match
   * @returns {boolean} true if importJSON matches the signature, false otherwise
   */
  isCoriolisFullBackupFormat: function(importJson) { // Using Coriolis Backup JSON
    return Boolean(importJson.builds !== null && importJson.comparisons && importJson.insurance !== null && importJson.shipDiscount !== null && importJson.moduleDiscount !== null);
  },

  /**
   * Test if importJSON matches the loadout event from the Elite: Dangerous game engine's journal files
   * @param importJson the JSON Object to check for a signature match
   * @returns {boolean} true if importJSON matches the signature, false otherwise
   */
  isEliteDangerousJournalFilesLoadoutEventFormat: function(importJson) {
    return Boolean(importJson.Modules != null && importJson.Modules[0] != null); // Import a Loadout event from Elite: Dangerous journal files
  },
};

/**
 * Import Modal
 */
export default class ModalImport extends TranslatedComponent {

  static propTypes = {
    importString: PropTypes.string, // Optional: Default data for import modal
    builds: PropTypes.object,  // Optional: Import object
  };

  /**
   * Constructor
   * @param  {Object} props   React Component properties
   */
  constructor(props) {
    super(props);

    this.state = {
      builds: props.builds,
      canEdit: !props.builds,
      comparisons: null,
      shipDiscount: null,
      moduleDiscount: null,
      errorMsg: null,
      importString: props.importString || null,
      importValid: false,
      insurance: null
    };

    this._process = this._process.bind(this);
    this._import = this._import.bind(this);
    this._importLoadout = this._importLoadout.bind(this);
    this._validateImport = this._validateImport.bind(this);
  }

  /**
   * Validate the import string / text box contents
   * @param  {SyntheticEvent} event Event
   * @throws {string} If validation fails
   */
  _validateImport(event) {
    const importString = event.target.value.trim();
    if (!importString) return;

    this.setState({
      builds: null,
      comparisons: null,
      shipDiscount: null,
      moduleDiscount: null,
      errorMsg: null,
      importValid: false,
      insurance: null,
      singleBuild: false,
      importString: importString,
    });

    try {
      if (dataFormats.isEdsyTextFormat(importString)) { // EDSY Text ?
        this.setState(shipFromEdsyText(importString));
      } else { // Assume the data is JSON
        const importData = JSON.parse(importString);
        if (!importData || typeof importData !== 'object') {
          const errorString = 'Parsed JSON must be an object or array!';
          console.log(errorString);
          this.setState({ errorMsg: errorString });
          return;
        }

        // Inara SLEF format
        if (dataFormats.isInaraSlefFormat(importData)) {
          this.setState(shipFromInaraSlef(importData));
          return;
        }

        // Companion API formats
        if (dataFormats.isCompanionApiSingleShipFormat(importData)) {
          this.setState(shipFromCompanionApi(importData)); // Single ship definition
          return;
        }
        if (dataFormats.isCompanionApiFullDataFormat(importData)) {
          this.setState(shipFromCompanionApi(importData.ship)); // Complete API dump
          return;
        }

        // Coriolis formats
        if (dataFormats.isCoriolisDetailedExportFormat(importData)) {
          this.setState(shipFromCoriolisDetailedFormat(importData));
          return;
        }
        if (dataFormats.isCoriolisSingleShipFormat(importData)) {
          this.setState(shipFromCoriolisSingleShipFormat(importData));
          return;
        }
        if (dataFormats.isCoriolisFullBackupFormat(importData)) {
          this.setState(backupFromCoriolisFullBackupFormat(importData));
          return;
        }

        // Elite Dangerous Journal files events format
        if (dataFormats.isEliteDangerousJournalFilesLoadoutEventFormat(importData)) {
          this.setState(shipFromEdGameEngineJournalFileLoadoutEvent(importData));
          return;
        }

        const errorString = 'Provided data does not match any known signature!';
        console.log(errorString);
        this.setState({ errorMsg: errorString });
        return;
      }
    } catch (e) {
      console.log(e);
      this.setState({ errorMsg: (typeof e == 'string') ? e : 'Could not parse the data!' });
      return;
    }
  };

  /**
   * Process imported data
   */
  _process() {
    let builds = null, comparisons = null;

    // If only importing a single build go straight to the outfitting page
    if (this.state.singleBuild) {
      builds = this.state.builds;
      let shipId = Object.keys(builds)[0];
      let name = Object.keys(builds[shipId])[0];
      Router.go(outfitURL(shipId, builds[shipId][name], name));
      return;
    }


    if (this.state.builds) {
      builds = {};   // Create new builds object such that orginal name retained, but can be renamed
      for (let shipId in this.state.builds) {
        let shipbuilds = this.state.builds[shipId];
        builds[shipId] = {};
        for (let buildName in shipbuilds) {
          builds[shipId][buildName] = {
            code: shipbuilds[buildName],
            useName: buildName
          };
        }
      }
    }

    if (this.state.comparisons) {
      comparisons = {};
      for (let name in this.state.comparisons) {
        comparisons[name] = Object.assign({ useName: name }, this.state.comparisons[name]);
      }
    }

    this.setState({ processed: true, builds, comparisons });
  };

  /**
   * Import parsed, processed data and save
   */
  _import() {
    let state = this.state;
    if (state.builds) {
      let builds = state.builds;
      for (let shipId in builds) {
        for (let buildName in builds[shipId]) {
          let build = builds[shipId][buildName];
          let name = build.useName.trim();
          if (name) {
            Persist.saveBuild(shipId, name, build.code);
          }
        }
      }
    }

    if (state.comparisons) {
      let comparisons = state.comparisons;
      for (let comp in comparisons) {
        let comparison = comparisons[comp];
        let useName = comparison.useName.trim();
        if (useName) {
          Persist.saveComparison(useName, comparison.builds, comparison.facets);
        }
      }
    }

    if (state.shipDiscount !== undefined) {
      Persist.setShipDiscount(state.shipDiscount);
    }
    if (state.moduleDiscount !== undefined) {
      Persist.setModuleDiscount(state.moduleDiscount);
    }

    if (state.insurance) {
      Persist.setInsurance(state.insurance);
    }

    this.context.hideModal();
  };

  /**
   * Capture build name changes
   * @param  {Object} item          Build/Comparison import object
   * @param  {SyntheticEvent} e     Event
   */
  _changeName(item, e) {
    item.useName = e.target.value;
    this.forceUpdate();
  }

  /**
   * If imported data is already provided process immediately on mount
   */
  UNSAFE_componentWillMount() {
    if (this.props.builds) {
      this._process();
    }
  }
  /**
   * If textarea is shown focus on mount
   */
  componentDidMount() {
    if (!this.props.builds && this.importField) {
      this.importField.focus();
    }
  }

  /**
   * Render the import modal
   * @return {React.Component} Modal contents
   */
  render() {
    let translate = this.context.language.translate;
    let state = this.state;
    let importStage;

    if (!state.processed) {
      importStage = (
        <div>
          <div class={'imprt_text'} dangerouslySetInnerHTML={{ __html: translate('IMPORT_TEXT') }} />
          <textarea spellCheck={false} className='cb json' ref={node => this.importField = node} onChange={this._validateImport} defaultValue={this.state.importString} placeholder={translate('PHRASE_IMPORT')} />
          <button id='proceed' className='l cap' onClick={this._process} disabled={!state.importValid} >{translate('proceed')}</button>
          <div className='l warning' style={{ marginLeft:'3em' }}>{state.errorMsg}</div>
        </div>
      );
    } else {
      let comparisonTable, edit, buildRows = [];
      if (state.comparisons) {
        let comparisonRows = [];

        for (let name in state.comparisons) {
          let comparison = state.comparisons[name];
          let hasComparison = Persist.hasComparison(comparison.useName);
          comparisonRows.push(
            <tr key={name} className='cb'>
              <td>
                <input type='text' onChange={this._changeName.bind(this, comparison)} value={comparison.useName}/>
              </td>
              <td style={{ textAlign:'center' }} className={ cn('cap', { warning: hasComparison, disabled: comparison.useName == '' }) }>
                {translate(comparison.useName == '' ? 'skip' : (hasComparison ? 'overwrite' : 'create'))}
              </td>
            </tr>
          );
        }

        comparisonTable = (
          <table className='l' style={{ overflow:'hidden', margin: '1em 0', width: '100%' }} >
            <thead>
              <tr>
                <th style={{ textAlign:'left' }}>{translate('comparison')}</th>
                <th>{translate('action')}</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows}
            </tbody>
          </table>
        );
      }

      if(this.state.canEdit) {
        edit = <button className='l cap' style={{ marginLeft: '2em' }} onClick={() => this.setState({ processed: false })}>{translate('edit data')}</button>;
      }

      let builds = this.state.builds;
      for (let shipId in builds) {
        let shipBuilds = builds[shipId];
        for (let buildName in shipBuilds) {
          let b = shipBuilds[buildName];
          let hasBuild = Persist.hasBuild(shipId, b.useName);
          buildRows.push(
            <tr key={shipId + buildName} className='cb'>
              <td>{Ships[shipId].properties.name}</td>
              <td><input type='text' onChange={this._changeName.bind(this, b)} value={b.useName}/></td>
              <td style={{ textAlign: 'center' }} className={cn('cap', { warning: hasBuild, disabled: b.useName == '' })}>
                {translate(b.useName == '' ? 'skip'  : (hasBuild ? 'overwrite' : 'create'))}
              </td>
            </tr>
          );
        }
      }

      importStage = (
        <div>
          <table className='l' style={{ overflow:'hidden', margin: '1em 0', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }} >{translate('ship')}</th>
                <th style={{ textAlign: 'left' }} >{translate('build name')}</th>
                <th>{translate('action')}</th>
              </tr>
            </thead>
            <tbody>
              {buildRows}
            </tbody>
          </table>
          {comparisonTable}
          <button id='import' className='cl l' onClick={this._import}><Download/> {translate('import')}</button>
          {edit}
        </div>
      );
    }

    return <div className='modal' onClick={ (e) => e.stopPropagation() }>
      <h2 >{translate('import')}</h2>
      {importStage}
      <button className={'r dismiss cap'} onClick={this.context.hideModal}>{translate('close')}</button>
    </div>;
  }
}
