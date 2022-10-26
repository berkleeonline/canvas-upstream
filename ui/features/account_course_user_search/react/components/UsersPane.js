/*
 * Copyright (C) 2015 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react'
import {shape, func, string} from 'prop-types'
import {useScope as useI18nScope} from '@canvas/i18n'
import {debounce, isEmpty} from 'lodash'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import UsersList from './UsersList'
import UsersToolbar from './UsersToolbar'
import SearchMessage from './SearchMessage'
import SRSearchMessage from './SRSearchMessage'
import UserActions from '../actions/UserActions'

const I18n = useI18nScope('account_course_user_search')

const MIN_SEARCH_LENGTH = 2
export const SEARCH_DEBOUNCE_TIME = 750

export default class UsersPane extends React.Component {
  static propTypes = {
    store: shape({
      getState: func.isRequired,
      dispatch: func.isRequired,
      subscribe: func.isRequired,
    }).isRequired,
    roles: UsersToolbar.propTypes.roles,
    onUpdateQueryParams: func.isRequired,
    queryParams: shape({
      page: string,
      search_term: string,
      role_filter_id: string,
    }).isRequired,
  }

  constructor(props) {
    super(props)

    this.state = {
      userList: props.store.getState().userList,
      srMessageDisplayed: false,
    }
    this.columnHeader = null
    this.debouncedDispatchApplySearchFilter = debounce(
      this.handleApplyingSearchFilter,
      SEARCH_DEBOUNCE_TIME
    )
  }

  componentDidMount() {
    this.unsubscribe = this.props.store.subscribe(this.handleStateChange)

    // make page reflect what the querystring params asked for
    const {search_term, role_filter_id} = {...UsersToolbar.defaultProps, ...this.props.queryParams}
    this.props.store.dispatch(UserActions.updateSearchFilter({search_term, role_filter_id}))

    this.props.store.dispatch(UserActions.applySearchFilter(MIN_SEARCH_LENGTH))
  }

  componentDidUpdate() {
    if (this.columnHeader && this.columnHeader.id) {
      const columnHeaderButton = document.getElementById(this.columnHeader.id)
      if (columnHeaderButton) columnHeaderButton.focus()
    }
  }

  componentWillUnmount() {
    this.unsubscribe()
  }

  handleStateChange = () => {
    const userList = this.props.store.getState().userList
    const lastPage = userList?.links?.last?.page
    this.setState(oldState => {
      const newState = {userList}
      if (lastPage && !oldState.knownLastPage) newState.knownLastPage = lastPage
      return newState
    })
  }

  handleApplyingSearchFilter = (preserveLastPageValue = false) => {
    this.props.store.dispatch(UserActions.applySearchFilter(MIN_SEARCH_LENGTH))
    this.updateQueryString()
    if (!preserveLastPageValue) this.setState({knownLastPage: undefined})
  }

  setColumnHeaderRef = element => {
    if (element) this.columnHeader = element
  }

  updateQueryString = () => {
    const searchFilter = this.props.store.getState().userList.searchFilter
    this.props.onUpdateQueryParams(searchFilter)
  }

  handleUpdateSearchFilter = searchFilter => {
    this.props.store.dispatch(UserActions.updateSearchFilter({page: null, ...searchFilter}))
    this.debouncedDispatchApplySearchFilter()
  }

  handleSubmitEditUserForm = () => {
    this.handleApplyingSearchFilter()
  }

  handleSetPage = page => {
    this.props.store.dispatch(UserActions.updateSearchFilter({page}))
    this.handleApplyingSearchFilter(true)
  }

  render() {
    const {links, accountId, users, isLoading, errors, searchFilter} = this.state.userList
    return (
      <div>
        <ScreenReaderContent>
          <h1>{I18n.t('People')}</h1>
        </ScreenReaderContent>

        <UsersToolbar
          onUpdateFilters={this.handleUpdateSearchFilter}
          onApplyFilters={this.handleApplyingSearchFilter}
          errors={errors}
          {...searchFilter}
          accountId={accountId.toString()}
          roles={this.props.roles}
          toggleSRMessage={(show = false) => {
            this.setState({srMessageDisplayed: show})
          }}
        />

        {!isEmpty(users) && !isLoading && (
          <UsersList
            searchFilter={this.state.userList.searchFilter}
            onUpdateFilters={this.handleUpdateSearchFilter}
            accountId={accountId.toString()}
            users={users}
            handleSubmitEditUserForm={this.handleSubmitEditUserForm}
            permissions={this.state.userList.permissions}
            columnHeaderRef={this.setColumnHeaderRef}
          />
        )}

        <SearchMessage
          collection={{data: users, loading: isLoading, links}}
          setPage={this.handleSetPage}
          knownLastPage={this.state.knownLastPage}
          noneFoundMessage={I18n.t('No users found')}
        />
        {this.state.srMessageDisplayed && (
          <SRSearchMessage collection={{data: users, loading: isLoading, links}} dataType="User" />
        )}
      </div>
    )
  }
}
